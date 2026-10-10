import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import {
  adminOfferSchema,
  loginResponseSchema,
  offerErrorSchema,
  ownerOfferSchema,
} from '@gossip/shared';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Runs against the real database. Everything it creates is tied to e-mails and
// plan names starting with `itest-offers-<run>`, and only that is removed
// afterwards (offers, subscriptions, venues, plans, users). Seed accounts,
// venues and plans are never read or changed.
const RUN = randomUUID().slice(0, 8);
const PREFIX = `itest-offers-${RUN}-`;
const email = (name: string) =>
  `${PREFIX}${name.toLowerCase()}@gossip-society.example`;
const PASSWORD = 'integration-test-password';
const DAY = 24 * 3600 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs);

describe('offers, subscriptions and quota against PostgreSQL', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  const tokens = new Map<string, string>();
  const userIds = new Map<string, string>();
  let planCount = 0;

  const request = (
    method: string,
    path: string,
    who: string | null,
    payload?: unknown,
  ) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(payload === undefined
          ? {}
          : { 'content-type': 'application/json' }),
        ...(who ? { authorization: `Bearer ${tokens.get(who)}` } : {}),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });

  async function makeUser(name: string, role: 'ADMIN' | 'VENUE_OWNER') {
    const user = await prisma.user.create({
      data: {
        email: email(name),
        name: `Test ${name}`,
        role,
        status: 'ACTIVE',
        passwordHash: await hash(PASSWORD),
      },
    });
    userIds.set(name, user.id);
    const res = await request('POST', '/auth/login', null, {
      email: email(name),
      password: PASSWORD,
    });
    tokens.set(name, loginResponseSchema.parse(await res.json()).accessToken);
    return user;
  }

  // A venue with one branch for an owner (inserted directly: no endpoint adds a venue to an existing owner).
  async function makeVenue(ownerName: string, venueName: string) {
    const venue = await prisma.venue.create({
      data: {
        name: `${PREFIX}${venueName}`,
        ownerId: userIds.get(ownerName)!,
        branches: {
          create: { name: 'Merkez', city: 'İstanbul', address: 'Adres' },
        },
      },
      include: { branches: true },
    });
    return { venueId: venue.id, branchId: venue.branches[0]!.id };
  }

  async function subscribe(
    venueId: string,
    quota: number,
    startsAt = at(-DAY),
    endsAt = at(30 * DAY),
  ) {
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: `${PREFIX}plan-${++planCount}`,
        activeOfferQuota: quota,
        monthlyMatchQuota: 100,
      },
    });
    return prisma.subscription.create({
      data: { venueId, planId: plan.id, startsAt, endsAt },
    });
  }

  const offerBody = (
    branchId: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    branchId,
    title: 'Akşam yemeği',
    description: 'İki kişilik akşam yemeği daveti',
    serviceDescription: 'İki kişilik tadım menüsü',
    serviceValueKurus: 250_000,
    expectedContent: 'Bir reels videosu ve üç story',
    minFollowers: 5000,
    capacity: 4,
    validFrom: at(DAY).toISOString(),
    validUntil: at(30 * DAY).toISOString(),
    ...overrides,
  });
  const draft = async (
    who: string,
    branchId: string,
    overrides: Record<string, unknown> = {},
  ) => {
    const res = await request(
      'POST',
      '/offers/mine',
      who,
      offerBody(branchId, overrides),
    );
    expect(res.status).toBe(201);
    return ownerOfferSchema.parse(await res.json());
  };
  const publish = (who: string, id: string) =>
    request('POST', `/offers/mine/${id}/publish`, who);
  const code = async (res: Response) =>
    offerErrorSchema.parse(await res.json()).code;
  const dbStatus = async (id: string) =>
    (await prisma.offer.findUniqueOrThrow({ where: { id } })).status;
  const publishedCount = (venueId: string) =>
    prisma.offer.count({
      where: {
        status: 'PUBLISHED',
        validUntil: { gt: new Date() },
        branch: { venueId },
      },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = moduleRef.get(PrismaService);
    await makeUser('admin', 'ADMIN');
    await makeUser('ownerA', 'VENUE_OWNER');
    await makeUser('ownerB', 'VENUE_OWNER');
  });

  afterAll(async () => {
    const owners = { owner: { email: { startsWith: PREFIX } } };
    await prisma.offer.deleteMany({ where: { branch: { venue: owners } } });
    await prisma.subscription.deleteMany({ where: { venue: owners } });
    await prisma.venue.deleteMany({ where: owners });
    await prisma.subscriptionPlan.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await app.close();
  });

  it('draft -> edit -> publish -> admin suspend, as stored in the database', async () => {
    const { venueId, branchId } = await makeVenue('ownerA', 'akis');
    await subscribe(venueId, 2);

    const created = await draft('ownerA', branchId, {
      validFrom: '2026-12-01T12:00:00+03:00',
      validUntil: '2027-01-01T12:00:00+03:00',
    });
    expect(created.status).toBe('DRAFT');
    // UTC in the database, whatever offset was sent.
    const stored = await prisma.offer.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.validFrom.toISOString()).toBe('2026-12-01T09:00:00.000Z');
    expect(stored.serviceValueKurus).toBe(250_000);

    const { branchId: _b, ...fields } = offerBody(branchId, {
      title: 'Düzenlendi',
      capacity: 7,
    });
    void _b;
    const edited = await request(
      'PUT',
      `/offers/mine/${created.id}`,
      'ownerA',
      fields,
    );
    expect(ownerOfferSchema.parse(await edited.json())).toMatchObject({
      title: 'Düzenlendi',
      capacity: 7,
      status: 'DRAFT',
    });

    const published = ownerOfferSchema.parse(
      await (await publish('ownerA', created.id)).json(),
    );
    expect(published.status).toBe('PUBLISHED');
    expect(
      (await prisma.offer.findUniqueOrThrow({ where: { id: created.id } }))
        .publishedAt,
    ).not.toBeNull();
    // Published offers can no longer be edited.
    expect(
      (await request('PUT', `/offers/mine/${created.id}`, 'ownerA', fields))
        .status,
    ).toBe(409);

    const suspendedRes = await request(
      'POST',
      `/admin/offers/${created.id}/suspend`,
      'admin',
      { reason: 'Uygunsuz içerik' },
    );
    const suspended = adminOfferSchema.parse(await suspendedRes.json());
    expect(suspended.suspension?.suspendedBy.id).toBe(userIds.get('admin'));
    const row = await prisma.offer.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row).toMatchObject({
      status: 'SUSPENDED',
      suspensionReason: 'Uygunsuz içerik',
      suspendedById: userIds.get('admin'),
    });
    expect(row.suspendedAt).not.toBeNull();
    // The owner can not bring it back.
    expect(await code(await publish('ownerA', created.id))).toBe(
      'OFFER_NOT_DRAFT',
    );
  });

  it('refuses to publish without a valid subscription (none, ended, not started) and changes nothing', async () => {
    const { venueId, branchId } = await makeVenue('ownerA', 'abonelik');
    const offer = await draft('ownerA', branchId);

    expect(await code(await publish('ownerA', offer.id))).toBe(
      'NO_ACTIVE_SUBSCRIPTION',
    );
    await subscribe(venueId, 5, at(-30 * DAY), at(-DAY));
    expect(await code(await publish('ownerA', offer.id))).toBe(
      'NO_ACTIVE_SUBSCRIPTION',
    );
    await subscribe(venueId, 5, at(DAY), at(30 * DAY));
    expect(await code(await publish('ownerA', offer.id))).toBe(
      'NO_ACTIVE_SUBSCRIPTION',
    );

    const row = await prisma.offer.findUniqueOrThrow({
      where: { id: offer.id },
    });
    expect(row).toMatchObject({ status: 'DRAFT', publishedAt: null });
  });

  it('counts future-start offers and ignores drafts, suspended and expired ones', async () => {
    const { venueId, branchId } = await makeVenue('ownerA', 'kota');
    await subscribe(venueId, 2);
    // Not counted: an expired published offer, a suspended one, a draft.
    await prisma.offer.create({
      data: {
        ...rawOffer(branchId),
        status: 'PUBLISHED',
        publishedAt: at(-20 * DAY),
        validFrom: at(-20 * DAY),
        validUntil: at(-DAY),
      },
    });
    await prisma.offer.create({
      data: {
        ...rawOffer(branchId),
        status: 'SUSPENDED',
        publishedAt: at(-2 * DAY),
        suspendedAt: at(-DAY),
        suspensionReason: 'x',
        suspendedById: userIds.get('admin')!,
      },
    });
    await draft('ownerA', branchId);

    const future = await draft('ownerA', branchId, {
      validFrom: at(20 * DAY).toISOString(),
      validUntil: at(25 * DAY).toISOString(),
    });
    const second = await draft('ownerA', branchId);
    const third = await draft('ownerA', branchId);

    expect((await publish('ownerA', future.id)).status).toBe(200); // a future start counts
    expect((await publish('ownerA', second.id)).status).toBe(200);
    expect(await code(await publish('ownerA', third.id))).toBe(
      'QUOTA_EXCEEDED',
    );
    expect(await publishedCount(venueId)).toBe(2);
  });

  it('refuses an offer whose validity ended', async () => {
    const { venueId, branchId } = await makeVenue('ownerA', 'sureci-bitmis');
    await subscribe(venueId, 3);
    const row = await prisma.offer.create({
      data: {
        ...rawOffer(branchId),
        validFrom: at(-10 * DAY),
        validUntil: at(-DAY),
      },
    });
    expect(await code(await publish('ownerA', row.id))).toBe('OFFER_EXPIRED');
    expect(await dbStatus(row.id)).toBe('DRAFT');
  });

  it('publishing the same offer many times at once uses the quota once', async () => {
    const { venueId, branchId } = await makeVenue('ownerA', 'tekrar');
    await subscribe(venueId, 2);
    const offer = await draft('ownerA', branchId);
    const other = await draft('ownerA', branchId);

    const responses = await Promise.all(
      Array.from({ length: 8 }, () => publish('ownerA', offer.id)),
    );

    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(200));
    const times = new Set(
      await Promise.all(
        responses.map(
          async (r) => ownerOfferSchema.parse(await r.json()).publishedAt,
        ),
      ),
    );
    expect(times.size).toBe(1); // one publish, the rest returned it unchanged
    expect(await publishedCount(venueId)).toBe(1);
    expect((await publish('ownerA', other.id)).status).toBe(200); // the second slot is still free
  });

  it('never exceeds the quota when different offers race for the last slots', async () => {
    for (const [round, quota, drafts] of [
      [1, 1, 8],
      [2, 3, 10],
      [3, 2, 6],
    ] as const) {
      const { venueId, branchId } = await makeVenue('ownerA', `yaris-${round}`);
      await subscribe(venueId, quota);
      const offers = await Promise.all(
        Array.from({ length: drafts }, () => draft('ownerA', branchId)),
      );

      const responses = await Promise.all(
        offers.map((o) => publish('ownerA', o.id)),
      );

      const ok = responses.filter((r) => r.status === 200).length;
      const full = responses.filter((r) => r.status === 409);
      expect(ok).toBe(quota);
      expect(full).toHaveLength(drafts - quota);
      expect(await Promise.all(full.map(code))).toEqual(
        Array(drafts - quota).fill('QUOTA_EXCEEDED'),
      );
      expect(await publishedCount(venueId)).toBe(quota);
    }
  });

  it('races for the LAST free slot with part of the quota already used', async () => {
    const { venueId, branchId } = await makeVenue('ownerA', 'son-hak');
    await subscribe(venueId, 3);
    const [first, second] = [
      await draft('ownerA', branchId),
      await draft('ownerA', branchId),
    ];
    await publish('ownerA', first.id);
    await publish('ownerA', second.id);
    const contenders = await Promise.all(
      Array.from({ length: 6 }, () => draft('ownerA', branchId)),
    );

    const responses = await Promise.all(
      contenders.map((o) => publish('ownerA', o.id)),
    );

    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await publishedCount(venueId)).toBe(3);
  });

  it('keeps the quota per venue: venues do not take each other’s slots and race independently', async () => {
    const one = await makeVenue('ownerA', 'bagimsiz-1');
    const two = await makeVenue('ownerB', 'bagimsiz-2');
    await subscribe(one.venueId, 2);
    await subscribe(two.venueId, 2);
    const offersOne = await Promise.all(
      Array.from({ length: 4 }, () => draft('ownerA', one.branchId)),
    );
    const offersTwo = await Promise.all(
      Array.from({ length: 4 }, () => draft('ownerB', two.branchId)),
    );

    await Promise.all([
      ...offersOne.map((o) => publish('ownerA', o.id)),
      ...offersTwo.map((o) => publish('ownerB', o.id)),
    ]);

    expect(await publishedCount(one.venueId)).toBe(2);
    expect(await publishedCount(two.venueId)).toBe(2);
  });

  it('a refused publish rolls back cleanly and does not block later publishes of the venue', async () => {
    const { venueId, branchId } = await makeVenue('ownerA', 'kilit');
    await subscribe(venueId, 1);
    const [a, b] = [
      await draft('ownerA', branchId),
      await draft('ownerA', branchId),
    ];
    await publish('ownerA', a.id);

    expect(await code(await publish('ownerA', b.id))).toBe('QUOTA_EXCEEDED'); // threw inside the transaction
    expect(await dbStatus(b.id)).toBe('DRAFT');

    // The row lock was released with the rollback: the admin's suspend and the next publish go through at once.
    expect(
      (
        await request('POST', `/admin/offers/${a.id}/suspend`, 'admin', {
          reason: 'Kural ihlali',
        })
      ).status,
    ).toBe(200);
    expect((await publish('ownerA', b.id)).status).toBe(200);
    expect(await publishedCount(venueId)).toBe(1);
  });

  it('frees the slot when an admin suspends an offer', async () => {
    const { venueId, branchId } = await makeVenue('ownerA', 'askiya');
    await subscribe(venueId, 1);
    const [a, b] = [
      await draft('ownerA', branchId),
      await draft('ownerA', branchId),
    ];
    await publish('ownerA', a.id);
    expect(await code(await publish('ownerA', b.id))).toBe('QUOTA_EXCEEDED');

    await request('POST', `/admin/offers/${a.id}/suspend`, 'admin', {
      reason: 'x',
    });

    expect(await publishedCount(venueId)).toBe(0);
    expect((await publish('ownerA', b.id)).status).toBe(200);
  });

  it('racing suspend and publish leaves the quota consistent', async () => {
    const { venueId, branchId } = await makeVenue('ownerA', 'suspend-yaris');
    await subscribe(venueId, 1);
    const [a, b] = [
      await draft('ownerA', branchId),
      await draft('ownerA', branchId),
    ];
    await publish('ownerA', a.id);

    const [suspend, pub] = await Promise.all([
      request('POST', `/admin/offers/${a.id}/suspend`, 'admin', {
        reason: 'x',
      }),
      publish('ownerA', b.id),
    ]);

    expect(suspend.status).toBe(200);
    expect([200, 409]).toContain(pub.status);
    expect(await publishedCount(venueId)).toBeLessThanOrEqual(1);
    expect(await dbStatus(a.id)).toBe('SUSPENDED');
  });

  it('owners reach only their own offers; roles are enforced', async () => {
    const a = await makeVenue('ownerA', 'sahiplik-a');
    const b = await makeVenue('ownerB', 'sahiplik-b');
    const mine = await draft('ownerA', a.branchId);
    const theirs = await draft('ownerB', b.branchId);

    expect(
      (await request('GET', `/offers/mine/${theirs.id}`, 'ownerA')).status,
    ).toBe(404);
    expect(
      (await request('POST', '/offers/mine', 'ownerA', offerBody(b.branchId)))
        .status,
    ).toBe(404);
    expect((await publish('ownerA', theirs.id)).status).toBe(404);
    expect(
      (await request('GET', `/offers/mine/${mine.id}`, 'ownerA')).status,
    ).toBe(200);
    expect((await request('GET', '/offers/mine', 'admin')).status).toBe(403);
    expect((await request('GET', '/admin/offers', 'ownerA')).status).toBe(403);
    expect(await dbStatus(theirs.id)).toBe('DRAFT');
  });

  it('lists offers with stable paging for the owner and the admin', async () => {
    const { branchId } = await makeVenue('ownerB', 'liste');
    for (let i = 1; i <= 5; i++)
      await draft('ownerB', branchId, { title: `Liste ${i}` });

    const seen: string[] = [];
    for (let page = 1; ; page++) {
      const body = (await (
        await request('GET', `/offers/mine?page=${page}&pageSize=2`, 'ownerB')
      ).json()) as {
        items: { id: string }[];
        totalPages: number;
        total: number;
      };
      seen.push(...body.items.map((o) => o.id));
      if (page >= body.totalPages) {
        expect(body.total).toBe(seen.length);
        break;
      }
    }
    expect(new Set(seen).size).toBe(seen.length);
    const adminList = (await (
      await request('GET', '/admin/offers?status=DRAFT&pageSize=50', 'admin')
    ).json()) as { items: { id: string }[] };
    expect(adminList.items.length).toBeGreaterThan(0);
    expect(
      (await request('GET', '/admin/offers?pageSize=51', 'admin')).status,
    ).toBe(400);
  });

  describe('database rules', () => {
    it('refuses overlapping subscription periods of one venue but allows back-to-back ones', async () => {
      const { venueId } = await makeVenue('ownerA', 'cakisma');
      const start = at(-5 * DAY);
      const mid = at(5 * DAY);
      await subscribe(venueId, 1, start, mid);

      await expect(
        subscribe(venueId, 1, at(DAY), at(10 * DAY)),
      ).rejects.toThrow(); // overlaps
      await expect(
        subscribe(venueId, 1, at(-10 * DAY), at(-4 * DAY)),
      ).rejects.toThrow(); // overlaps the start
      await expect(subscribe(venueId, 1, start, mid)).rejects.toThrow(); // identical
      await subscribe(venueId, 1, mid, at(20 * DAY)); // starts exactly when the previous ends: fine
      // Another venue is independent.
      const other = await makeVenue('ownerB', 'cakisma-digeri');
      await subscribe(other.venueId, 1, start, mid);
    });

    it('refuses an empty or negative period and negative quotas', async () => {
      const { venueId } = await makeVenue('ownerA', 'gecersiz-donem');
      await expect(subscribe(venueId, 1, at(DAY), at(DAY))).rejects.toThrow();
      await expect(
        subscribe(venueId, 1, at(2 * DAY), at(DAY)),
      ).rejects.toThrow();
      await expect(
        prisma.subscriptionPlan.create({
          data: {
            name: `${PREFIX}negatif`,
            activeOfferQuota: -1,
            monthlyMatchQuota: 0,
          },
        }),
      ).rejects.toThrow();
    });

    it('refuses invalid offer rows even if the API were bypassed', async () => {
      const { branchId } = await makeVenue('ownerA', 'kisit');
      const bad = [
        { serviceValueKurus: 0 },
        { capacity: 0 },
        { minFollowers: -1 },
        { validFrom: at(2 * DAY), validUntil: at(DAY) },
        { status: 'PUBLISHED' as const }, // published without publishedAt
        { status: 'SUSPENDED' as const, publishedAt: new Date() }, // suspended without reason/admin
      ];
      for (const override of bad) {
        await expect(
          prisma.offer.create({ data: { ...rawOffer(branchId), ...override } }),
        ).rejects.toThrow();
      }
    });
  });

  function rawOffer(branchId: string) {
    return {
      branchId,
      title: 'Ham ilan',
      description: 'd',
      serviceDescription: 's',
      serviceValueKurus: 1000,
      expectedContent: 'e',
      minFollowers: 0,
      capacity: 1,
      validFrom: at(DAY),
      validUntil: at(30 * DAY),
    };
  }
});
