import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import {
  discoverOfferListSchema,
  discoverOfferSchema,
  loginResponseSchema,
  ownerOfferSchema,
  type UserRole,
} from '@gossip/shared';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Influencer discovery against the real database. Everything created is tied to
// e-mails / plan names starting with `itest-disc-<run>` and removed afterwards;
// seed accounts, venues and offers are never read or changed. Other offers that
// may exist in the database are ignored by filtering on this run's own ids.
const RUN = randomUUID().slice(0, 8);
const PREFIX = `itest-disc-${RUN}-`;
const PASSWORD = 'integration-test-password';
const DAY = 24 * 3600 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs);

describe('influencer offer discovery against PostgreSQL', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  const tokens = new Map<string, string>();
  const email = (name: string) =>
    `${PREFIX}${name.toLowerCase()}@gossip-society.example`;
  let branchId: string;
  let venueId: string;
  let venueName: string;

  const get = (path: string, who: string | null) =>
    fetch(`${baseUrl}${path}`, {
      headers: who ? { authorization: `Bearer ${tokens.get(who)}` } : {},
    });
  const send = (method: string, path: string, who: string, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${tokens.get(who)}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  async function makeUser(
    name: string,
    role: UserRole,
    status: 'ACTIVE' | 'PENDING' = 'ACTIVE',
  ) {
    const user = await prisma.user.create({
      data: {
        email: email(name),
        name: `Test ${name}`,
        role,
        status,
        passwordHash: await hash(PASSWORD),
      },
    });
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email(name), password: PASSWORD }),
    });
    // A PENDING account can't sign in: its token is made by a real session instead.
    if (res.status === 200) {
      tokens.set(name, loginResponseSchema.parse(await res.json()).accessToken);
    }
    return user;
  }

  const offerData = (overrides: Record<string, unknown> = {}) => ({
    branchId,
    title: `${PREFIX}ilan`,
    description: 'İki kişilik akşam yemeği daveti',
    serviceDescription: 'İki kişilik tadım menüsü',
    serviceValueKurus: 250_000,
    expectedContent: 'Bir reels ve üç story',
    minFollowers: 5000,
    capacity: 4,
    validFrom: at(-DAY),
    validUntil: at(DAY),
    status: 'PUBLISHED' as const,
    publishedAt: at(-1000),
    ...overrides,
  });
  const make = (overrides: Record<string, unknown> = {}) =>
    prisma.offer.create({ data: offerData(overrides) });

  // This run's offers in the discovery list, first page of 50.
  async function mine(): Promise<string[]> {
    const res = await get('/discover/offers?pageSize=50', 'influencer');
    expect(res.status).toBe(200);
    const list = discoverOfferListSchema.parse(await res.json());
    return list.items
      .filter((i) => i.title.startsWith(PREFIX))
      .map((i) => i.id);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = moduleRef.get(PrismaService);
    await makeUser('admin', 'ADMIN');
    const owner = await makeUser('owner', 'VENUE_OWNER');
    await makeUser('influencer', 'INFLUENCER');
    await makeUser('staff', 'VENUE_STAFF');
    venueName = `${PREFIX}Kafe`;
    const venue = await prisma.venue.create({
      data: {
        name: venueName,
        ownerId: owner.id,
        branches: {
          create: {
            name: 'Kadıköy',
            city: 'İstanbul',
            address: 'Bağdat Cad. 1',
          },
        },
      },
      include: { branches: true },
    });
    venueId = venue.id;
    branchId = venue.branches[0]!.id;
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: `${PREFIX}plan`,
        activeOfferQuota: 50,
        monthlyMatchQuota: 50,
      },
    });
    await prisma.subscription.create({
      data: {
        venueId,
        planId: plan.id,
        startsAt: at(-DAY),
        endsAt: at(30 * DAY),
      },
    });
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

  afterEach(async () => {
    await prisma.offer.deleteMany({ where: { branchId } });
  });

  it('shows only published offers that are valid right now, in list and detail', async () => {
    const visible = await make({ title: `${PREFIX}görünür` });
    const draft = await make({ status: 'DRAFT', publishedAt: null });
    const suspended = await make({
      status: 'SUSPENDED',
      suspendedAt: new Date(),
      suspensionReason: 'sebep',
      suspendedById: (
        await prisma.user.findFirstOrThrow({ where: { email: email('admin') } })
      ).id,
    });
    const future = await make({ validFrom: at(DAY), validUntil: at(2 * DAY) });
    const ended = await make({
      validFrom: at(-2 * DAY),
      validUntil: at(-1000),
    });

    expect(await mine()).toEqual([visible.id]);
    expect(
      (await get(`/discover/offers/${visible.id}`, 'influencer')).status,
    ).toBe(200);
    for (const hidden of [draft, suspended, future, ended]) {
      expect(
        (await get(`/discover/offers/${hidden.id}`, 'influencer')).status,
      ).toBe(404);
    }
  });

  it('the total counts exactly what the visibility rule selects', async () => {
    await make();
    await make();
    await make({ status: 'DRAFT', publishedAt: null });
    await make({ validUntil: at(-1000), validFrom: at(-DAY) });
    const now = new Date();
    const expected = await prisma.offer.count({
      where: {
        status: 'PUBLISHED',
        validFrom: { lte: now },
        validUntil: { gt: now },
      },
    });
    const list = discoverOfferListSchema.parse(
      await (await get('/discover/offers?pageSize=1', 'influencer')).json(),
    );
    expect(list.total).toBe(expected);
    expect(list.totalPages).toBe(Math.ceil(expected / 1));
  });

  it('the whole flow: publish -> visible -> admin suspends -> the detail closes at once', async () => {
    const draft = ownerOfferSchema.parse(
      await (
        await send('POST', '/offers/mine', 'owner', {
          branchId,
          title: `${PREFIX}akış`,
          description: 'd',
          serviceDescription: 's',
          serviceValueKurus: 100_000,
          expectedContent: 'e',
          minFollowers: 0,
          capacity: 2,
          validFrom: at(-DAY).toISOString(),
          validUntil: at(DAY).toISOString(),
        })
      ).json(),
    );
    // A draft is not discoverable.
    expect(await mine()).toEqual([]);
    expect(
      (await get(`/discover/offers/${draft.id}`, 'influencer')).status,
    ).toBe(404);

    expect(
      (await send('POST', `/offers/mine/${draft.id}/publish`, 'owner')).status,
    ).toBe(200);
    expect(await mine()).toEqual([draft.id]);
    const detail = await get(`/discover/offers/${draft.id}`, 'influencer');
    expect(detail.status).toBe(200);
    expect(discoverOfferSchema.parse(await detail.json())).toMatchObject({
      id: draft.id,
      venue: { name: venueName },
      branch: { name: 'Kadıköy', city: 'İstanbul', address: 'Bağdat Cad. 1' },
    });

    // The list was read; now the admin suspends it.
    expect(
      (
        await send('POST', `/admin/offers/${draft.id}/suspend`, 'admin', {
          reason: 'test',
        })
      ).status,
    ).toBe(200);
    expect(
      (await get(`/discover/offers/${draft.id}`, 'influencer')).status,
    ).toBe(404);
    expect(await mine()).toEqual([]);
  });

  it('an offer that ends while the influencer is looking closes: the detail answers 404 after validUntil', async () => {
    const soon = await make({ validUntil: at(1500) });
    expect(
      (await get(`/discover/offers/${soon.id}`, 'influencer')).status,
    ).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 1800));
    expect(
      (await get(`/discover/offers/${soon.id}`, 'influencer')).status,
    ).toBe(404);
    expect(await mine()).toEqual([]);
  });

  it('starts showing an offer when its validFrom arrives', async () => {
    const later = await make({ validFrom: at(1500), validUntil: at(DAY) });
    expect(
      (await get(`/discover/offers/${later.id}`, 'influencer')).status,
    ).toBe(404);
    await new Promise((resolve) => setTimeout(resolve, 1800));
    expect(
      (await get(`/discover/offers/${later.id}`, 'influencer')).status,
    ).toBe(200);
    expect(await mine()).toEqual([later.id]);
  });

  it('orders by publication time, newest first, ties by id, and pages without repeats or gaps', async () => {
    const t = at(-5000);
    const rows = [
      await make({ title: `${PREFIX}a`, publishedAt: at(-30_000) }),
      await make({ title: `${PREFIX}b`, publishedAt: at(-10_000) }),
      await make({ title: `${PREFIX}c`, publishedAt: t }),
      await make({ title: `${PREFIX}d`, publishedAt: t }),
      await make({ title: `${PREFIX}e`, publishedAt: at(-20_000) }),
    ];
    const tie = [rows[2]!.id, rows[3]!.id].sort().reverse();
    // Newest first: the tied pair (5 s ago), then b (10 s), e (20 s), a (30 s).
    const expected = [...tie, rows[1]!.id, rows[4]!.id, rows[0]!.id];
    // Pages of two over the whole table (other runs' or seed offers may sit around ours).
    const seen: string[] = [];
    for (let page = 1; page < 200; page++) {
      const list = discoverOfferListSchema.parse(
        await (
          await get(`/discover/offers?page=${page}&pageSize=2`, 'influencer')
        ).json(),
      );
      seen.push(...list.items.map((i) => i.id));
      if (page >= list.totalPages) break;
    }
    expect(new Set(seen).size).toBe(seen.length); // no repeats
    expect(seen.filter((id) => expected.includes(id))).toEqual(expected);
  });

  it('exposes nothing about the owner, users, admins or the subscription', async () => {
    const offer = await make({ suspendedById: null });
    const texts = [
      await (await get('/discover/offers?pageSize=50', 'influencer')).text(),
      await (await get(`/discover/offers/${offer.id}`, 'influencer')).text(),
    ];
    const ownerRow = await prisma.user.findFirstOrThrow({
      where: { email: email('owner') },
    });
    for (const text of texts) {
      expect(text).not.toContain(PREFIX + 'owner');
      expect(text).not.toContain('@gossip-society.example');
      expect(text).not.toContain(ownerRow.id);
      expect(text).not.toContain(venueId);
      expect(text).not.toContain(branchId);
      expect(text).not.toMatch(
        /passwordHash|argon2|plan|subscription|status|suspen|publishedAt/i,
      );
    }
  });

  it('is for ACTIVE influencers only', async () => {
    const offer = await make();
    expect((await get('/discover/offers', null)).status).toBe(401);
    for (const who of ['owner', 'staff', 'admin']) {
      expect((await get('/discover/offers', who)).status).toBe(403);
      expect((await get(`/discover/offers/${offer.id}`, who)).status).toBe(403);
    }
    // A pending influencer cannot even sign in, so it has no token to try with.
    await makeUser('pendinginf', 'INFLUENCER', 'PENDING');
    expect(tokens.has('pendinginf')).toBe(false);
    // An influencer who is suspended AFTER signing in is refused on the next call.
    await makeUser('later', 'INFLUENCER');
    expect((await get('/discover/offers', 'later')).status).toBe(200);
    await prisma.user.update({
      where: { email: email('later') },
      data: { status: 'SUSPENDED' },
    });
    expect((await get('/discover/offers', 'later')).status).toBe(403);
    expect((await get(`/discover/offers/${offer.id}`, 'later')).status).toBe(
      403,
    );
  });

  it('keeps /offers/mine for owners', async () => {
    expect((await get('/offers/mine', 'owner')).status).toBe(200);
    expect((await get('/offers/mine', 'influencer')).status).toBe(403);
  });
});
