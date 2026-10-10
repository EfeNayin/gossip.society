import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  discoverOfferListSchema,
  discoverOfferSchema,
  type UserRole,
} from '@gossip/shared';
import {
  createFakePrisma,
  createSessionWithToken,
  createTestApp,
  makeUser,
  type FakeOffer,
} from '../auth/auth-test-utils.js';

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs);
const ids = {
  admin: '00000000-0000-4000-8000-0000000000e1',
  owner: '00000000-0000-4000-8000-0000000000e2',
  influencer: '00000000-0000-4000-8000-0000000000e3',
  staff: '00000000-0000-4000-8000-0000000000e4',
  pending: '00000000-0000-4000-8000-0000000000e5',
  suspended: '00000000-0000-4000-8000-0000000000e6',
};
type Who = keyof typeof ids;

describe('influencer offer discovery over HTTP', () => {
  let app: INestApplication;
  let baseUrl: string;
  let fake: ReturnType<typeof createFakePrisma>;
  const tokens = new Map<string, string>();
  let branchId: string;
  let sequence = 0;

  const call = (path: string, who: Who | null, method = 'GET') =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: who ? { authorization: `Bearer ${tokens.get(who)}` } : {},
    });

  // Inserted directly: the point is what DISCOVERY shows for each state.
  function seed(overrides: Partial<FakeOffer> = {}): FakeOffer {
    const offer: FakeOffer = {
      id: randomUUID(),
      branchId,
      title: `İlan ${++sequence}`,
      description: 'İki kişilik akşam yemeği daveti',
      serviceDescription: 'İki kişilik tadım menüsü',
      serviceValueKurus: 250_000,
      expectedContent: 'Bir reels ve üç story',
      minFollowers: 5000,
      capacity: 4,
      validFrom: at(-DAY),
      validUntil: at(DAY),
      status: 'PUBLISHED',
      publishedAt: at(-sequence * HOUR),
      suspendedAt: null,
      suspensionReason: null,
      suspendedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    fake.offers.set(offer.id, offer);
    return offer;
  }
  const listIds = async (query = '', who: Who = 'influencer') => {
    const res = await call(`/discover/offers${query}`, who);
    expect(res.status).toBe(200);
    return discoverOfferListSchema.parse(await res.json());
  };

  beforeEach(async () => {
    fake = createFakePrisma();
    const accounts: [Who, UserRole, 'ACTIVE' | 'PENDING' | 'SUSPENDED'][] = [
      ['admin', 'ADMIN', 'ACTIVE'],
      ['owner', 'VENUE_OWNER', 'ACTIVE'],
      ['influencer', 'INFLUENCER', 'ACTIVE'],
      ['staff', 'VENUE_STAFF', 'ACTIVE'],
      ['pending', 'INFLUENCER', 'PENDING'],
      ['suspended', 'INFLUENCER', 'SUSPENDED'],
    ];
    for (const [key, role, status] of accounts) {
      fake.users.set(
        ids[key],
        makeUser({
          id: ids[key],
          role,
          status,
          name: key,
          email: `${key}-gizli@kafe.example`,
        }),
      );
    }
    const created = await createTestApp(fake.prisma);
    app = created.app;
    baseUrl = created.baseUrl;
    const jwt = created.moduleRef.get(JwtService);
    for (const key of Object.keys(ids) as Who[]) {
      tokens.set(
        key,
        (await createSessionWithToken(fake, jwt, ids[key])).accessToken,
      );
    }
    const venue = await fake.prisma.venue.create({
      data: {
        name: 'Kafe Gizli',
        description: null,
        ownerId: ids.owner,
        branches: {
          create: {
            name: 'Kadıköy',
            city: 'İstanbul',
            address: 'Bağdat Cad. 1',
          },
        },
      },
      include: { owner: true, branches: {} },
    });
    branchId = [...fake.branches.values()].find(
      (b) => b.venueId === venue.id,
    )!.id;
    sequence = 0;
  });

  afterEach(() => app.close());

  describe('who may use it', () => {
    it('serves an ACTIVE influencer', async () => {
      seed();
      expect((await listIds()).items).toHaveLength(1);
    });

    it.each(['owner', 'staff', 'admin'] as const)(
      'refuses %s with 403, on the list and the detail',
      async (who) => {
        const offer = seed();
        expect((await call('/discover/offers', who)).status).toBe(403);
        expect((await call(`/discover/offers/${offer.id}`, who)).status).toBe(
          403,
        );
      },
    );

    it('has no guest discovery: 401 without a token', async () => {
      const offer = seed();
      expect((await call('/discover/offers', null)).status).toBe(401);
      expect((await call(`/discover/offers/${offer.id}`, null)).status).toBe(
        401,
      );
    });

    it.each(['pending', 'suspended'] as const)(
      'refuses a %s influencer account',
      async (who) => {
        const offer = seed();
        expect((await call('/discover/offers', who)).status).toBe(403);
        expect((await call(`/discover/offers/${offer.id}`, who)).status).toBe(
          403,
        );
      },
    );

    it('does not accept writes', async () => {
      const offer = seed();
      for (const method of ['POST', 'PUT', 'DELETE']) {
        expect(
          (await call(`/discover/offers/${offer.id}`, 'influencer', method))
            .status,
        ).toBeGreaterThanOrEqual(400);
      }
      expect(fake.offers.get(offer.id)!.status).toBe('PUBLISHED');
    });
  });

  describe('visibility: PUBLISHED and validFrom <= now < validUntil', () => {
    it('shows a published, currently valid offer', async () => {
      const offer = seed();
      const list = await listIds();
      expect(list.items.map((o) => o.id)).toEqual([offer.id]);
      expect(list.total).toBe(1);
    });

    it.each([
      ['a DRAFT', { status: 'DRAFT' as const, publishedAt: null }],
      [
        'a SUSPENDED offer',
        {
          status: 'SUSPENDED' as const,
          suspendedAt: new Date(),
          suspensionReason: 'sebep',
        },
      ],
      ['an offer that has not started', { validFrom: at(HOUR) }],
      [
        'an offer that has ended',
        { validUntil: at(-HOUR), validFrom: at(-DAY) },
      ],
    ])('hides %s from the list AND the detail (404)', async (_n, change) => {
      seed(); // one visible offer, so an empty list is not by accident
      const hidden = seed(change);
      const list = await listIds();
      expect(list.items.map((o) => o.id)).not.toContain(hidden.id);
      expect(list.total).toBe(1);
      expect(
        (await call(`/discover/offers/${hidden.id}`, 'influencer')).status,
      ).toBe(404);
    });

    it('treats the start as inclusive and the end as exclusive', async () => {
      const startsNow = seed({ validFrom: at(-50), validUntil: at(DAY) });
      const endedJustNow = seed({ validFrom: at(-DAY), validUntil: at(-1) });
      const startsSoon = seed({ validFrom: at(60_000), validUntil: at(DAY) });
      const ids = (await listIds()).items.map((o) => o.id);
      expect(ids).toContain(startsNow.id);
      expect(ids).not.toContain(endedJustNow.id);
      expect(ids).not.toContain(startsSoon.id);
    });

    it('on the exact boundaries: starting at "now" is visible, ending at "now" is not', async () => {
      // Only Date is frozen (timers stay real), so "now" is the same instant for the
      // test's data and for the request.
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        const now = new Date();
        const startsExactlyNow = seed({ validFrom: now, validUntil: at(DAY) });
        const endsExactlyNow = seed({ validFrom: at(-DAY), validUntil: now });
        const shown = (await listIds()).items.map((o) => o.id);
        expect(shown).toContain(startsExactlyNow.id);
        expect(shown).not.toContain(endsExactlyNow.id);
        expect(
          (await call(`/discover/offers/${endsExactlyNow.id}`, 'influencer'))
            .status,
        ).toBe(404);
        expect(
          (await call(`/discover/offers/${startsExactlyNow.id}`, 'influencer'))
            .status,
        ).toBe(200);
      } finally {
        vi.useRealTimers();
      }
    });

    it('an offer suspended after the list was read can no longer be opened', async () => {
      const offer = seed();
      expect((await listIds()).items.map((o) => o.id)).toContain(offer.id);
      expect(
        (await call(`/discover/offers/${offer.id}`, 'influencer')).status,
      ).toBe(200);

      Object.assign(fake.offers.get(offer.id)!, {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspensionReason: 'sebep',
      });

      expect(
        (await call(`/discover/offers/${offer.id}`, 'influencer')).status,
      ).toBe(404);
      expect((await listIds()).items).toHaveLength(0);
    });

    it('an offer that ends after the list was read can no longer be opened', async () => {
      const offer = seed();
      expect(
        (await call(`/discover/offers/${offer.id}`, 'influencer')).status,
      ).toBe(200);
      fake.offers.get(offer.id)!.validUntil = at(-1);
      expect(
        (await call(`/discover/offers/${offer.id}`, 'influencer')).status,
      ).toBe(404);
    });

    it('a missing and a hidden offer look the same (same 404 body)', async () => {
      const hidden = seed({ status: 'DRAFT', publishedAt: null });
      const a = await call(`/discover/offers/${hidden.id}`, 'influencer');
      const b = await call(`/discover/offers/${randomUUID()}`, 'influencer');
      expect(a.status).toBe(404);
      expect(await a.json()).toEqual(await b.json());
    });

    it('does not look at the subscription: a published offer stays visible until it ends', async () => {
      seed();
      expect(fake.subscriptions.size).toBe(0);
      expect((await listIds()).items).toHaveLength(1);
    });
  });

  describe('what the response contains', () => {
    it('the detail has the service, conditions and venue/branch, in kuruş and UTC', async () => {
      const offer = seed({
        validFrom: new Date('2026-01-01T06:00:00Z'),
        validUntil: at(DAY),
      });
      const res = await call(`/discover/offers/${offer.id}`, 'influencer');
      expect(res.status).toBe(200);
      expect(discoverOfferSchema.parse(await res.json())).toEqual({
        id: offer.id,
        title: offer.title,
        description: 'İki kişilik akşam yemeği daveti',
        serviceDescription: 'İki kişilik tadım menüsü',
        serviceValueKurus: 250_000,
        expectedContent: 'Bir reels ve üç story',
        minFollowers: 5000,
        capacity: 4,
        validFrom: '2026-01-01T06:00:00.000Z',
        validUntil: offer.validUntil.toISOString(),
        venue: { name: 'Kafe Gizli' },
        branch: { name: 'Kadıköy', city: 'İstanbul', address: 'Bağdat Cad. 1' },
      });
    });

    it('leaks nothing about the owner, users, admins, subscriptions or ids of venue/branch', async () => {
      const offer = seed({
        status: 'PUBLISHED',
        suspendedById: ids.admin,
        suspensionReason: 'eski sebep',
      });
      fake.plans.set('p', {
        id: 'p',
        name: 'Gizli Paket',
        activeOfferQuota: 3,
        monthlyMatchQuota: 9,
      });
      const bodies = [
        await (await call('/discover/offers', 'influencer')).text(),
        await (await call(`/discover/offers/${offer.id}`, 'influencer')).text(),
      ];
      const [venue] = [...fake.venues.values()];
      for (const text of bodies) {
        expect(text).not.toMatch(
          /gizli@|owner|argon|passwordHash|admin|Gizli Paket|plan|subscription|status|publishedAt|suspen|eski sebep|createdAt|updatedAt/i,
        );
        expect(text).not.toContain(venue!.id);
        expect(text).not.toContain(branchId);
        expect(text).not.toContain(ids.owner);
        expect(text).not.toContain(ids.admin);
      }
    });

    it('shows the minimum followers as a condition and invents nothing about eligibility', async () => {
      seed({ minFollowers: 10_000 });
      const [item] = (await listIds()).items;
      expect(item!.minFollowers).toBe(10_000);
      const text = JSON.stringify(item);
      expect(text).not.toMatch(
        /eligible|uygun|remaining|kalan|follower(?!s)|score|rating/i,
      );
    });

    it('the list card is a summary (no description, capacity or address)', async () => {
      seed();
      const [item] = (await listIds()).items;
      expect(item).not.toHaveProperty('description');
      expect(item).not.toHaveProperty('capacity');
      expect(item!.branch).toEqual({ name: 'Kadıköy', city: 'İstanbul' });
    });
  });

  describe('paging and order', () => {
    it('orders newest published first, then by id, stably', async () => {
      const older = seed({ publishedAt: at(-3 * HOUR) });
      const newest = seed({ publishedAt: at(-1 * HOUR) });
      const middle = seed({ publishedAt: at(-2 * HOUR) });
      const tieA = seed({ publishedAt: at(-10 * HOUR) });
      const tieB = seed({ publishedAt: tieA.publishedAt });
      const first = (await listIds()).items.map((o) => o.id);
      const [highId, lowId] = [tieA.id, tieB.id].sort().reverse();
      expect(first).toEqual([newest.id, middle.id, older.id, highId, lowId]);
      expect((await listIds()).items.map((o) => o.id)).toEqual(first);
    });

    it('pages without repeats or gaps, and reports the totals', async () => {
      for (let i = 0; i < 7; i++) seed();
      seed({ status: 'DRAFT', publishedAt: null }); // never counted
      const seen: string[] = [];
      for (let page = 1; page <= 4; page++) {
        const list = await listIds(`?page=${page}&pageSize=3`);
        expect(list).toMatchObject({
          page,
          pageSize: 3,
          total: 7,
          totalPages: 3,
        });
        seen.push(...list.items.map((o) => o.id));
      }
      expect(seen).toHaveLength(7);
      expect(new Set(seen).size).toBe(7);
      expect((await listIds('?page=4&pageSize=3')).items).toEqual([]);
    });

    it('is empty (not an error) when nothing is visible', async () => {
      seed({ status: 'DRAFT', publishedAt: null });
      expect(await listIds()).toMatchObject({
        items: [],
        total: 0,
        totalPages: 0,
      });
    });

    it.each([
      'page=0',
      'page=-1',
      'page=x',
      'pageSize=0',
      'pageSize=51',
      'pageSize=1000',
    ])('rejects %s with 400', async (query) => {
      expect(
        (await call(`/discover/offers?${query}`, 'influencer')).status,
      ).toBe(400);
    });

    it('defaults to 20 per page and allows at most 50', async () => {
      for (let i = 0; i < 55; i++) seed();
      expect((await listIds()).items).toHaveLength(20);
      expect((await listIds('?pageSize=50')).items).toHaveLength(50);
    });

    it('ignores a status filter sent by the client', async () => {
      seed();
      seed({ status: 'DRAFT', publishedAt: null });
      expect((await listIds('?status=DRAFT')).total).toBe(1);
      expect((await listIds('?status=DRAFT')).items[0]!.title).toBe('İlan 1');
    });

    it('rejects a malformed id with 400', async () => {
      expect(
        (await call('/discover/offers/not-a-guid', 'influencer')).status,
      ).toBe(400);
    });
  });

  it('does not disturb /offers/mine: the owner routes are unchanged', async () => {
    expect((await call('/offers/mine', 'owner')).status).toBe(200);
    expect((await call('/offers/mine', 'influencer')).status).toBe(403);
  });
});
