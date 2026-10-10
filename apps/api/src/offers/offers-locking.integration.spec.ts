import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import {
  loginResponseSchema,
  offerErrorSchema,
  ownerOfferSchema,
} from '@gossip/shared';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Controlled ordering tests against the real database. They do NOT rely on
// racing requests: the test itself holds a lock (the venue row, or the
// Subscription table), starts the requests one by one, waits until PostgreSQL
// reports each one as blocked (pg_stat_activity), and only then lets them run.
// That fixes the order in which the critical statements execute.
//
// Everything created is tied to e-mails / plan names starting with
// `itest-offerlock-<run>` and removed afterwards.
const RUN = randomUUID().slice(0, 8);
const PREFIX = `itest-offerlock-${RUN}-`;
const PASSWORD = 'integration-test-password';
const DAY = 24 * 3600 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// How long the "short validity" scenarios last, and how long they wait: the
// validity ends while the request is blocked, so only a fresh clock reading
// (taken after the wait) sees it.
const SHORT = 2200;
const WAIT_PAST_SHORT = 2900;

describe('editing and publishing share one lock (PostgreSQL, controlled order)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let ownerToken: string;
  let adminToken: string;
  let ownerId: string;
  let adminId: string;
  let planCount = 0;
  let venueCount = 0;

  const request = (
    method: string,
    path: string,
    token: string,
    payload?: unknown,
  ) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
  const publish = (id: string) =>
    request('POST', `/offers/mine/${id}/publish`, ownerToken);
  const edit = (id: string, fields: Record<string, unknown>) =>
    request('PUT', `/offers/mine/${id}`, ownerToken, editBody(fields));
  const code = async (res: Response) =>
    offerErrorSchema.parse(await res.json()).code;

  const editBody = (overrides: Record<string, unknown> = {}) => ({
    title: 'Düzenlenmiş başlık',
    description: 'd',
    serviceDescription: 's',
    serviceValueKurus: 200_000,
    expectedContent: 'e',
    minFollowers: 0,
    capacity: 3,
    validFrom: at(DAY).toISOString(),
    validUntil: at(30 * DAY).toISOString(),
    ...overrides,
  });

  async function makeUser(name: string, role: 'ADMIN' | 'VENUE_OWNER') {
    const email = `${PREFIX}${name}@gossip-society.example`;
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role,
        status: 'ACTIVE',
        passwordHash: await hash(PASSWORD),
      },
    });
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    return {
      id: user.id,
      token: loginResponseSchema.parse(await res.json()).accessToken,
    };
  }

  async function makeVenue(
    quota: number,
    subscription: { startsAt?: Date; endsAt?: Date } = {},
  ) {
    const venue = await prisma.venue.create({
      data: {
        name: `${PREFIX}venue-${++venueCount}`,
        ownerId,
        branches: {
          create: { name: 'Merkez', city: 'İstanbul', address: 'Adres' },
        },
      },
      include: { branches: true },
    });
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: `${PREFIX}plan-${++planCount}`,
        activeOfferQuota: quota,
        monthlyMatchQuota: 10,
      },
    });
    await prisma.subscription.create({
      data: {
        venueId: venue.id,
        planId: plan.id,
        startsAt: subscription.startsAt ?? at(-DAY),
        endsAt: subscription.endsAt ?? at(60 * DAY),
      },
    });
    return { venueId: venue.id, branchId: venue.branches[0]!.id };
  }

  const makeOffer = (
    branchId: string,
    overrides: Record<string, unknown> = {},
  ) =>
    prisma.offer.create({
      data: {
        branchId,
        title: 'Taslak',
        description: 'd',
        serviceDescription: 's',
        serviceValueKurus: 100_000,
        expectedContent: 'e',
        minFollowers: 0,
        capacity: 2,
        validFrom: at(-DAY),
        validUntil: at(30 * DAY),
        ...overrides,
      },
    });
  const row = (id: string) => prisma.offer.findUniqueOrThrow({ where: { id } });

  // --- helpers that fix the order of events ------------------------------

  /** Holds the venue row lock (as publish/edit do) while `during` runs. */
  const holdVenueLock = <T>(venueId: string, during: () => Promise<T>) =>
    prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Venue" WHERE id = ${venueId}::uuid FOR UPDATE`;
        return during();
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

  /** Holds a lock that blocks every read of the Subscription table. */
  const holdSubscriptionTable = <T>(during: () => Promise<T>) =>
    prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          'LOCK TABLE "Subscription" IN ACCESS EXCLUSIVE MODE',
        );
        return during();
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

  /** Number of queries PostgreSQL reports as blocked on a lock whose text matches. */
  async function blocked(pattern: string): Promise<number> {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE ${pattern}`;
    return Number(rows[0]!.n);
  }
  async function waitUntilBlocked(
    pattern: string,
    count: number,
    label: string,
  ) {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if ((await blocked(pattern)) >= count) return;
      await sleep(25);
    }
    throw new Error(
      `Expected ${count} request(s) blocked on ${label}, but PostgreSQL shows ${await blocked(pattern)}`,
    );
  }
  const VENUE_LOCK = 'SELECT id FROM "Venue"%FOR UPDATE%';
  const SUBSCRIPTION_READ = '%"Subscription"%';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = moduleRef.get(PrismaService);
    const owner = await makeUser('owner', 'VENUE_OWNER');
    const admin = await makeUser('admin', 'ADMIN');
    ({ id: ownerId, token: ownerToken } = owner);
    ({ id: adminId, token: adminToken } = admin);
  });

  afterAll(async () => {
    const scope = { owner: { email: { startsWith: PREFIX } } };
    await prisma.offer.deleteMany({ where: { branch: { venue: scope } } });
    await prisma.subscription.deleteMany({ where: { venue: scope } });
    await prisma.venue.deleteMany({ where: scope });
    await prisma.subscriptionPlan.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await app.close();
  });

  it('1. an edit that completes first is seen by the publish: an offer edited to an ended validity is refused', async () => {
    const { venueId, branchId } = await makeVenue(3);
    const offer = await makeOffer(branchId);
    let editResponse!: Promise<Response>;
    let publishResponse!: Promise<Response>;

    await holdVenueLock(venueId, async () => {
      // Edit is queued first, publish second: the edit runs first.
      editResponse = edit(offer.id, {
        validFrom: at(-10 * DAY).toISOString(),
        validUntil: at(-DAY).toISOString(),
      });
      await waitUntilBlocked(VENUE_LOCK, 1, 'the edit');
      publishResponse = publish(offer.id);
      await waitUntilBlocked(VENUE_LOCK, 2, 'the edit and the publish');
    });

    expect((await editResponse).status).toBe(200);
    const refused = await publishResponse;
    expect(refused.status).toBe(409);
    expect(await code(refused)).toBe('OFFER_EXPIRED');
    expect(await row(offer.id)).toMatchObject({
      status: 'DRAFT',
      publishedAt: null,
    });
  });

  it('2. a publish that completes first makes the later edit fail with OFFER_NOT_DRAFT', async () => {
    const { venueId, branchId } = await makeVenue(3);
    const offer = await makeOffer(branchId, { title: 'Yayınlanan başlık' });
    let publishResponse!: Promise<Response>;
    let editResponse!: Promise<Response>;

    await holdVenueLock(venueId, async () => {
      publishResponse = publish(offer.id);
      await waitUntilBlocked(VENUE_LOCK, 1, 'the publish');
      editResponse = edit(offer.id, { title: 'Yayından sonra değişen başlık' });
      await waitUntilBlocked(VENUE_LOCK, 2, 'the publish and the edit');
    });

    expect((await publishResponse).status).toBe(200);
    const refused = await editResponse;
    expect(refused.status).toBe(409);
    expect(await code(refused)).toBe('OFFER_NOT_DRAFT');
    expect(await row(offer.id)).toMatchObject({
      status: 'PUBLISHED',
      title: 'Yayınlanan başlık',
    });
  });

  it('2b. an edit that arrives while a publish is in the middle of its checks can not slip in', async () => {
    const { branchId } = await makeVenue(3);
    const offer = await makeOffer(branchId);
    const original = await row(offer.id);
    let publishResponse!: Promise<Response>;
    let editResponse!: Promise<Response>;
    let editFinishedFirst = false;

    // The publish has the venue lock, has read and validated the offer, and is
    // now stuck reading the subscription (the table is locked by this test).
    await holdSubscriptionTable(async () => {
      publishResponse = publish(offer.id);
      await waitUntilBlocked(
        SUBSCRIPTION_READ,
        1,
        'the publish reading the subscription',
      );
      editResponse = edit(offer.id, {
        title: 'Araya giren düzenleme',
        validFrom: at(-10 * DAY).toISOString(),
        validUntil: at(-DAY).toISOString(),
      });
      // Correct code: the edit waits for the venue lock the publish holds.
      // Old code: the edit has no lock to wait for and finishes right now.
      const outcome = await Promise.race([
        editResponse.then(() => 'edit-finished' as const),
        waitUntilBlocked(VENUE_LOCK, 1, 'the edit').then(
          () => 'edit-waiting' as const,
        ),
      ]);
      editFinishedFirst = outcome === 'edit-finished';
    });

    expect((await publishResponse).status).toBe(200);
    const refused = await editResponse;
    expect(editFinishedFirst).toBe(false);
    expect(refused.status).toBe(409);
    expect(await code(refused)).toBe('OFFER_NOT_DRAFT');
    // The offer was published exactly as validated: the late edit changed nothing.
    const after = await row(offer.id);
    expect(after).toMatchObject({ status: 'PUBLISHED', title: original.title });
    expect(after.validUntil.getTime()).toBe(original.validUntil.getTime());
    expect(after.validUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('3a. an offer whose validity ends while the publish waits for the lock is refused (the clock is read after the wait)', async () => {
    const { venueId, branchId } = await makeVenue(3);
    const offer = await makeOffer(branchId, { validUntil: at(SHORT) });
    let publishResponse!: Promise<Response>;

    await holdVenueLock(venueId, async () => {
      publishResponse = publish(offer.id); // arrives while the offer is still valid
      await waitUntilBlocked(VENUE_LOCK, 1, 'the publish');
      await sleep(WAIT_PAST_SHORT); // ...and the validity ends while it waits
    });

    const refused = await publishResponse;
    expect(refused.status).toBe(409);
    expect(await code(refused)).toBe('OFFER_EXPIRED');
    expect(await row(offer.id)).toMatchObject({
      status: 'DRAFT',
      publishedAt: null,
    });
  });

  it('3b. a subscription that ends while the publish waits for the lock is not accepted', async () => {
    const { venueId, branchId } = await makeVenue(3, { endsAt: at(SHORT) });
    const offer = await makeOffer(branchId);
    let publishResponse!: Promise<Response>;

    await holdVenueLock(venueId, async () => {
      publishResponse = publish(offer.id); // the subscription is valid when it arrives
      await waitUntilBlocked(VENUE_LOCK, 1, 'the publish');
      await sleep(WAIT_PAST_SHORT);
    });

    const refused = await publishResponse;
    expect(refused.status).toBe(409);
    expect(await code(refused)).toBe('NO_ACTIVE_SUBSCRIPTION');
    expect(await row(offer.id)).toMatchObject({
      status: 'DRAFT',
      publishedAt: null,
    });
  });

  it('3c. the quota is judged at the same fresh time: a slot freed by an expiry during the wait is usable', async () => {
    const { venueId, branchId } = await makeVenue(1);
    // The only slot is used by an offer that expires while the next publish waits.
    await makeOffer(branchId, {
      status: 'PUBLISHED',
      publishedAt: at(-DAY),
      validUntil: at(SHORT),
    });
    const waiting = await makeOffer(branchId, { title: 'Bekleyen' });
    let publishResponse!: Promise<Response>;

    await holdVenueLock(venueId, async () => {
      publishResponse = publish(waiting.id);
      await waitUntilBlocked(VENUE_LOCK, 1, 'the publish');
      await sleep(WAIT_PAST_SHORT);
    });

    expect((await publishResponse).status).toBe(200);
    expect((await row(waiting.id)).status).toBe('PUBLISHED');
    // Judged by one clock: the offer that expired no longer counts.
    expect(
      await prisma.offer.count({
        where: {
          status: 'PUBLISHED',
          validUntil: { gt: new Date() },
          branch: { venueId },
        },
      }),
    ).toBe(1);
  });

  it('4. publishing again is still idempotent, also when the repeats queue behind the lock', async () => {
    const { venueId, branchId } = await makeVenue(2);
    const offer = await makeOffer(branchId);
    const other = await makeOffer(branchId, { title: 'İkinci' });
    let responses!: Promise<Response>[];

    await holdVenueLock(venueId, async () => {
      responses = [publish(offer.id), publish(offer.id), publish(offer.id)];
      await waitUntilBlocked(
        VENUE_LOCK,
        3,
        'three publishes of the same offer',
      );
    });

    const bodies = await Promise.all(
      (await Promise.all(responses)).map(async (r) => ({
        status: r.status,
        offer: ownerOfferSchema.parse(await r.json()),
      })),
    );
    expect(bodies.map((b) => b.status)).toEqual([200, 200, 200]);
    expect(new Set(bodies.map((b) => b.offer.publishedAt)).size).toBe(1);
    expect((await publish(other.id)).status).toBe(200); // only one slot was used
  });

  it('5. edits, publishes and suspensions interleaved on two venues all finish: no deadlock, quota respected', async () => {
    const one = await makeVenue(2);
    const two = await makeVenue(1);
    const offers = [
      ...(await Promise.all(
        Array.from({ length: 5 }, () => makeOffer(one.branchId)),
      )),
      ...(await Promise.all(
        Array.from({ length: 4 }, () => makeOffer(two.branchId)),
      )),
    ];

    const calls: Promise<Response>[] = [];
    for (const [i, offer] of offers.entries()) {
      calls.push(edit(offer.id, { title: `Karışık ${i}` }));
      calls.push(publish(offer.id));
      calls.push(edit(offer.id, { title: `Karışık ${i} b` }));
      calls.push(publish(offer.id));
      if (i % 3 === 0)
        calls.push(
          request('POST', `/admin/offers/${offer.id}/suspend`, adminToken, {
            reason: 'x',
          }),
        );
    }
    const results = await Promise.race([
      Promise.all(calls),
      sleep(30_000).then(() => {
        throw new Error('Requests did not finish: a deadlock?');
      }),
    ]);

    // Every answer is a normal API answer (never a 500 from a deadlock/serialization failure).
    expect(
      results.map((r) => r.status).filter((s) => ![200, 409].includes(s)),
    ).toEqual([]);
    for (const { venueId } of [one, two]) {
      const quota = venueId === one.venueId ? 2 : 1;
      expect(
        await prisma.offer.count({
          where: {
            status: 'PUBLISHED',
            validUntil: { gt: new Date() },
            branch: { venueId },
          },
        }),
      ).toBeLessThanOrEqual(quota);
    }
    // Rows are consistent with their status.
    for (const offer of offers) {
      const stored = await row(offer.id);
      if (stored.status !== 'DRAFT') expect(stored.publishedAt).not.toBeNull();
      if (stored.status === 'SUSPENDED')
        expect(stored.suspendedById).toBe(adminId);
    }
  });
});
