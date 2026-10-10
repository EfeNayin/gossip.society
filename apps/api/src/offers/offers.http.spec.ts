import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  adminOfferListSchema,
  adminOfferSchema,
  offerErrorSchema,
  ownerOfferListSchema,
  ownerOfferSchema,
  type UserRole,
} from '@gossip/shared';
import {
  createFakePrisma,
  createSessionWithToken,
  createTestApp,
  makeUser,
} from '../auth/auth-test-utils.js';

const DAY = 24 * 3600 * 1000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const ids = {
  admin: '00000000-0000-4000-8000-0000000000f1',
  ownerA: '00000000-0000-4000-8000-0000000000f2',
  ownerB: '00000000-0000-4000-8000-0000000000f3',
  influencer: '00000000-0000-4000-8000-0000000000f4',
  staff: '00000000-0000-4000-8000-0000000000f5',
  suspendedOwner: '00000000-0000-4000-8000-0000000000f6',
};
type Who = keyof typeof ids;

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
  validFrom: iso(DAY),
  validUntil: iso(30 * DAY),
  ...overrides,
});

describe('offers over HTTP', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtService;
  let fake: ReturnType<typeof createFakePrisma>;
  const tokens = new Map<string, string>();
  // Branches: A1 and A2 belong to owner A (two venues), B1 to owner B.
  let branchA1: string;
  let branchA2: string;
  let branchB1: string;
  let venueA1: string;

  const call = (
    method: string,
    path: string,
    who: Who | null,
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

  const createDraft = async (
    branchId: string,
    overrides: Record<string, unknown> = {},
    who: Who = 'ownerA',
  ) => {
    const res = await call(
      'POST',
      '/offers/mine',
      who,
      offerBody(branchId, overrides),
    );
    expect(res.status).toBe(201);
    return ownerOfferSchema.parse(await res.json());
  };
  const publish = (id: string, who: Who | null = 'ownerA') =>
    call('POST', `/offers/mine/${id}/publish`, who);
  const errorCode = async (res: Response) =>
    offerErrorSchema.parse(await res.json()).code;

  function addVenue(ownerKey: Who, name: string) {
    const before = new Set(fake.branches.keys());
    const venue = [...fake.venues.values()].length;
    void venue;
    return fake.prisma.venue
      .create({
        data: {
          name,
          description: null,
          ownerId: ids[ownerKey],
          branches: {
            create: {
              name: `${name} şubesi`,
              city: 'İstanbul',
              address: 'Adres',
            },
          },
        },
        include: { owner: true, branches: {} },
      })
      .then((v) => ({
        venueId: v.id,
        branchId: [...fake.branches.keys()].find((id) => !before.has(id))!,
      }));
  }
  const subscribe = (
    venueId: string,
    quota: number,
    startsAt = iso(-DAY),
    endsAt = iso(30 * DAY),
  ) => {
    const planId = `plan-${fake.plans.size + 1}`;
    fake.plans.set(planId, {
      id: planId,
      name: planId,
      activeOfferQuota: quota,
      monthlyMatchQuota: 99,
    });
    fake.subscriptions.set(`sub-${fake.subscriptions.size + 1}`, {
      id: `sub-${fake.subscriptions.size + 1}`,
      venueId,
      planId,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    });
  };

  beforeEach(async () => {
    fake = createFakePrisma();
    const roles: [Who, UserRole, 'ACTIVE' | 'SUSPENDED'][] = [
      ['admin', 'ADMIN', 'ACTIVE'],
      ['ownerA', 'VENUE_OWNER', 'ACTIVE'],
      ['ownerB', 'VENUE_OWNER', 'ACTIVE'],
      ['influencer', 'INFLUENCER', 'ACTIVE'],
      ['staff', 'VENUE_STAFF', 'ACTIVE'],
      ['suspendedOwner', 'VENUE_OWNER', 'SUSPENDED'],
    ];
    for (const [key, role, status] of roles) {
      fake.users.set(
        ids[key],
        makeUser({ id: ids[key], role, status, name: key }),
      );
    }
    const created = await createTestApp(fake.prisma);
    app = created.app;
    baseUrl = created.baseUrl;
    jwt = created.moduleRef.get(JwtService);
    for (const key of Object.keys(ids) as Who[]) {
      tokens.set(
        key,
        (await createSessionWithToken(fake, jwt, ids[key])).accessToken,
      );
    }
    const a1 = await addVenue('ownerA', 'Kafe A1');
    const a2 = await addVenue('ownerA', 'Bar A2');
    const b1 = await addVenue('ownerB', 'Restoran B1');
    ({ venueId: venueA1, branchId: branchA1 } = a1);
    branchA2 = a2.branchId;
    branchB1 = b1.branchId;
  });

  afterEach(() => app.close());

  describe('owner: draft, edit, read', () => {
    it('creates a DRAFT with the venue and branch, in UTC, with an integer value', async () => {
      const res = await call(
        'POST',
        '/offers/mine',
        'ownerA',
        offerBody(branchA1),
      );

      expect(res.status).toBe(201);
      const text = await res.text();
      const offer = ownerOfferSchema.parse(JSON.parse(text));
      expect(offer).toMatchObject({
        status: 'DRAFT',
        title: 'Akşam yemeği',
        serviceValueKurus: 250_000,
        minFollowers: 5000,
        capacity: 4,
        publishedAt: null,
        suspension: null,
        branch: { id: branchA1, name: 'Kafe A1 şubesi', city: 'İstanbul' },
        venue: { id: venueA1, name: 'Kafe A1' },
      });
      expect(offer.validFrom).toMatch(/Z$/);
      expect(Number.isInteger(offer.serviceValueKurus)).toBe(true);
      expect(text).not.toMatch(/passwordHash|ownerId|owner"/);
      expect(fake.offers.get(offer.id)!.status).toBe('DRAFT');
    });

    it('ignores status, ids and admin fields sent by the client', async () => {
      const res = await call('POST', '/offers/mine', 'ownerA', {
        ...offerBody(branchA1),
        status: 'PUBLISHED',
        publishedAt: iso(0),
        ownerId: ids.ownerB,
        venueId: 'x',
        suspendedById: ids.admin,
        suspensionReason: 'x',
      });

      expect(res.status).toBe(201);
      const stored = [...fake.offers.values()][0]!;
      expect(stored).toMatchObject({
        status: 'DRAFT',
        publishedAt: null,
        suspendedById: null,
        suspensionReason: null,
      });
    });

    it.each([
      ['another owner’s branch', () => branchB1],
      [
        'a branch that does not exist',
        () => '00000000-0000-4000-8000-0000000000aa',
      ],
    ])('answers 404 for %s and creates nothing', async (_label, branch) => {
      const res = await call(
        'POST',
        '/offers/mine',
        'ownerA',
        offerBody(branch()),
      );
      expect(res.status).toBe(404);
      expect(fake.offers.size).toBe(0);
    });

    it.each([
      ['a zero service value', { serviceValueKurus: 0 }],
      ['a fractional service value', { serviceValueKurus: 19.99 }],
      ['a service value as a string', { serviceValueKurus: '250000' }],
      ['a zero capacity', { capacity: 0 }],
      ['negative minimum followers', { minFollowers: -1 }],
      [
        'an end before the start',
        { validFrom: iso(10 * DAY), validUntil: iso(DAY) },
      ],
      [
        'an end equal to the start',
        { validFrom: iso(DAY), validUntil: iso(DAY) },
      ],
      ['a date without a zone', { validFrom: '2026-11-01T09:00:00' }],
      ['an empty title', { title: ' ' }],
      ['a too long description', { description: 'x'.repeat(2001) }],
    ])('rejects %s with 400', async (_label, override) => {
      const res = await call(
        'POST',
        '/offers/mine',
        'ownerA',
        offerBody(branchA1, override),
      );
      expect(res.status).toBe(400);
      expect(fake.offers.size).toBe(0);
    });

    it('lists only the caller’s offers, newest first, with paging and a status filter', async () => {
      const first = await createDraft(branchA1, { title: 'Bir' });
      const second = await createDraft(branchA2, { title: 'İki' });
      await createDraft(branchB1, { title: 'B nin' }, 'ownerB');
      await subscribe(venueA1, 5);
      await publish(first.id);

      const all = ownerOfferListSchema.parse(
        await (await call('GET', '/offers/mine', 'ownerA')).json(),
      );
      expect(all.items.map((o) => o.title)).toEqual(['İki', 'Bir']);
      expect(all).toMatchObject({ total: 2, page: 1, totalPages: 1 });

      const paged = ownerOfferListSchema.parse(
        await (
          await call('GET', '/offers/mine?page=2&pageSize=1', 'ownerA')
        ).json(),
      );
      expect(paged).toMatchObject({ total: 2, totalPages: 2, pageSize: 1 });
      expect(paged.items.map((o) => o.title)).toEqual(['Bir']);

      const drafts = ownerOfferListSchema.parse(
        await (await call('GET', '/offers/mine?status=DRAFT', 'ownerA')).json(),
      );
      expect(drafts.items.map((o) => o.id)).toEqual([second.id]);
      expect(
        (await call('GET', '/offers/mine?pageSize=51', 'ownerA')).status,
      ).toBe(400);
      expect(
        (await call('GET', '/offers/mine?status=ACTIVE', 'ownerA')).status,
      ).toBe(400);
    });

    it('reads one’s own offer and hides other owners’ offers (404, like a missing one)', async () => {
      const mine = await createDraft(branchA1);
      const theirs = await createDraft(branchB1, {}, 'ownerB');

      expect(
        (await call('GET', `/offers/mine/${mine.id}`, 'ownerA')).status,
      ).toBe(200);
      expect(
        (await call('GET', `/offers/mine/${theirs.id}`, 'ownerA')).status,
      ).toBe(404);
      expect(
        (
          await call(
            'GET',
            '/offers/mine/00000000-0000-4000-8000-0000000000bb',
            'ownerA',
          )
        ).status,
      ).toBe(404);
      expect(
        (await call('GET', '/offers/mine/not-an-id', 'ownerA')).status,
      ).toBe(400);
    });

    it('edits a draft; the branch and the status can not be changed through it', async () => {
      const draft = await createDraft(branchA1);
      const { branchId: _ignored, ...fields } = offerBody(branchA2, {
        title: 'Yeni başlık',
        capacity: 9,
      });
      void _ignored;

      const res = await call('PUT', `/offers/mine/${draft.id}`, 'ownerA', {
        ...fields,
        branchId: branchA2,
        status: 'PUBLISHED',
      });

      expect(res.status).toBe(200);
      const edited = ownerOfferSchema.parse(await res.json());
      expect(edited).toMatchObject({
        title: 'Yeni başlık',
        capacity: 9,
        status: 'DRAFT',
        branch: { id: branchA1 },
      });
      expect(fake.offers.get(draft.id)!.branchId).toBe(branchA1);
    });

    it('validates edits like creation', async () => {
      const draft = await createDraft(branchA1);
      const { branchId: _b, ...fields } = offerBody(branchA1);
      void _b;
      expect(
        (
          await call('PUT', `/offers/mine/${draft.id}`, 'ownerA', {
            ...fields,
            capacity: 0,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await call('PUT', `/offers/mine/${draft.id}`, 'ownerA', {
            ...fields,
            validUntil: fields.validFrom,
          })
        ).status,
      ).toBe(400);
      expect(fake.offers.get(draft.id)!.capacity).toBe(4);
    });

    it('refuses to edit someone else’s draft (404)', async () => {
      const theirs = await createDraft(branchB1, {}, 'ownerB');
      const { branchId: _b, ...fields } = offerBody(branchB1, {
        title: 'Ele geçirildi',
      });
      void _b;
      expect(
        (await call('PUT', `/offers/mine/${theirs.id}`, 'ownerA', fields))
          .status,
      ).toBe(404);
      expect(fake.offers.get(theirs.id)!.title).toBe('Akşam yemeği');
    });

    it.each(['PUBLISHED', 'SUSPENDED'] as const)(
      'refuses to edit a %s offer (409 OFFER_NOT_DRAFT)',
      async (status) => {
        const draft = await createDraft(branchA1);
        Object.assign(fake.offers.get(draft.id)!, {
          status,
          publishedAt: new Date(),
          ...(status === 'SUSPENDED'
            ? {
                suspendedAt: new Date(),
                suspensionReason: 'x',
                suspendedById: ids.admin,
              }
            : {}),
        });
        const { branchId: _b, ...fields } = offerBody(branchA1, {
          title: 'Değişti',
        });
        void _b;

        const res = await call(
          'PUT',
          `/offers/mine/${draft.id}`,
          'ownerA',
          fields,
        );

        expect(res.status).toBe(409);
        expect(await errorCode(res)).toBe('OFFER_NOT_DRAFT');
        expect(fake.offers.get(draft.id)!.title).toBe('Akşam yemeği');
      },
    );
  });

  describe('owner: publishing and the quota', () => {
    it('publishes a draft within the quota', async () => {
      await subscribe(venueA1, 2);
      const draft = await createDraft(branchA1);

      const res = await publish(draft.id);

      expect(res.status).toBe(200);
      const published = ownerOfferSchema.parse(await res.json());
      expect(published.status).toBe('PUBLISHED');
      expect(published.publishedAt).not.toBeNull();
    });

    it('needs a subscription: none, ended, or not started yet', async () => {
      const draft = await createDraft(branchA1);
      for (const [startsAt, endsAt] of [
        [undefined, undefined] as const,
        [iso(-30 * DAY), iso(-DAY)] as const,
        [iso(DAY), iso(30 * DAY)] as const,
      ]) {
        fake.subscriptions.clear();
        if (startsAt) await subscribe(venueA1, 5, startsAt, endsAt);

        const res = await publish(draft.id);

        expect(res.status).toBe(409);
        expect(await errorCode(res)).toBe('NO_ACTIVE_SUBSCRIPTION');
        expect(fake.offers.get(draft.id)!).toMatchObject({
          status: 'DRAFT',
          publishedAt: null,
        });
      }
    });

    it('applies the quota of the plan in the database, not a constant', async () => {
      await subscribe(venueA1, 1);
      const [one, two] = [
        await createDraft(branchA1),
        await createDraft(branchA1),
      ];
      expect((await publish(one.id)).status).toBe(200);
      const full = await publish(two.id);
      expect(full.status).toBe(409);
      expect(await errorCode(full)).toBe('QUOTA_EXCEEDED');

      // The plan is edited (a data change, no code change): room for two.
      for (const plan of fake.plans.values()) plan.activeOfferQuota = 2;
      expect((await publish(two.id)).status).toBe(200);
    });

    it('a quota of zero allows no publishing', async () => {
      await subscribe(venueA1, 0);
      const res = await publish((await createDraft(branchA1)).id);
      expect(await errorCode(res)).toBe('QUOTA_EXCEEDED');
    });

    it('counts offers that start in the future', async () => {
      await subscribe(venueA1, 1);
      const future = await createDraft(branchA1, {
        validFrom: iso(20 * DAY),
        validUntil: iso(25 * DAY),
      });
      expect((await publish(future.id)).status).toBe(200);
      const next = await createDraft(branchA1);
      expect(await errorCode(await publish(next.id))).toBe('QUOTA_EXCEEDED');
    });

    it('does not count drafts, suspended offers or offers whose validity has ended', async () => {
      await subscribe(venueA1, 1);
      // A published offer that has since expired, a suspended one and a draft.
      const expired = await createDraft(branchA1);
      Object.assign(fake.offers.get(expired.id)!, {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        validFrom: new Date(Date.now() - 10 * DAY),
        validUntil: new Date(Date.now() - DAY),
      });
      const suspended = await createDraft(branchA1);
      Object.assign(fake.offers.get(suspended.id)!, {
        status: 'SUSPENDED',
        publishedAt: new Date(),
        suspendedAt: new Date(),
        suspensionReason: 'x',
        suspendedById: ids.admin,
      });
      await createDraft(branchA1);

      const fresh = await createDraft(branchA1);
      expect((await publish(fresh.id)).status).toBe(200); // the single slot was free
    });

    it('refuses an offer whose validity already ended', async () => {
      await subscribe(venueA1, 5);
      const draft = await createDraft(branchA1);
      Object.assign(fake.offers.get(draft.id)!, {
        validFrom: new Date(Date.now() - 10 * DAY),
        validUntil: new Date(Date.now() - DAY),
      });

      const res = await publish(draft.id);

      expect(res.status).toBe(409);
      expect(await errorCode(res)).toBe('OFFER_EXPIRED');
      expect(fake.offers.get(draft.id)!.status).toBe('DRAFT');
    });

    it('publishing the same offer again does not use the quota a second time', async () => {
      await subscribe(venueA1, 2);
      const first = await createDraft(branchA1);
      const second = await createDraft(branchA1);
      const third = await createDraft(branchA1);

      const a = ownerOfferSchema.parse(await (await publish(first.id)).json());
      const again = await publish(first.id);
      const b = ownerOfferSchema.parse(await again.json());
      const c = await publish(first.id);

      expect(again.status).toBe(200);
      expect(c.status).toBe(200);
      expect(b.publishedAt).toBe(a.publishedAt); // unchanged
      expect((await publish(second.id)).status).toBe(200); // the second slot is still free
      expect(await errorCode(await publish(third.id))).toBe('QUOTA_EXCEEDED');
    });

    it('does not let the owner publish a SUSPENDED offer again', async () => {
      await subscribe(venueA1, 5);
      const draft = await createDraft(branchA1);
      Object.assign(fake.offers.get(draft.id)!, {
        status: 'SUSPENDED',
        publishedAt: new Date(),
        suspendedAt: new Date(),
        suspensionReason: 'x',
        suspendedById: ids.admin,
      });

      const res = await publish(draft.id);

      expect(res.status).toBe(409);
      expect(await errorCode(res)).toBe('OFFER_NOT_DRAFT');
      expect(fake.offers.get(draft.id)!.status).toBe('SUSPENDED');
    });

    it('keeps the quota per venue: another venue of the same owner has its own', async () => {
      await subscribe(venueA1, 1);
      const inA1 = await createDraft(branchA1);
      const inA2 = await createDraft(branchA2);
      expect((await publish(inA1.id)).status).toBe(200);
      // Venue A2 has no subscription: the slot of A1 does not help it.
      expect(await errorCode(await publish(inA2.id))).toBe(
        'NO_ACTIVE_SUBSCRIPTION',
      );
    });

    it('refuses to publish another owner’s offer (404) and leaves it a draft', async () => {
      await subscribe(venueA1, 5);
      const theirs = await createDraft(branchB1, {}, 'ownerB');
      expect((await publish(theirs.id)).status).toBe(404);
      expect(fake.offers.get(theirs.id)!.status).toBe('DRAFT');
    });
  });

  describe('admin', () => {
    it('lists every offer with its venue, owner and suspension, never a hash', async () => {
      await subscribe(venueA1, 5);
      const a = await createDraft(branchA1, { title: 'A nın' });
      await createDraft(branchB1, { title: 'B nin' }, 'ownerB');
      await publish(a.id);

      const res = await call('GET', '/admin/offers', 'admin');

      expect(res.status).toBe(200);
      const text = await res.text();
      const list = adminOfferListSchema.parse(JSON.parse(text));
      expect(list.items.map((o) => o.title)).toEqual(['B nin', 'A nın']);
      expect(list.items[1]!.venue.owner).toMatchObject({
        id: ids.ownerA,
        email: expect.any(String),
      });
      expect(text).not.toMatch(/passwordHash|argon2/);

      const published = adminOfferListSchema.parse(
        await (
          await call(
            'GET',
            '/admin/offers?status=PUBLISHED&pageSize=1',
            'admin',
          )
        ).json(),
      );
      expect(published).toMatchObject({ total: 1, pageSize: 1 });
    });

    it('reads one offer and answers 404 for a missing one', async () => {
      const offer = await createDraft(branchA1);
      expect(
        adminOfferSchema.parse(
          await (
            await call('GET', `/admin/offers/${offer.id}`, 'admin')
          ).json(),
        ).id,
      ).toBe(offer.id);
      expect(
        (
          await call(
            'GET',
            '/admin/offers/00000000-0000-4000-8000-0000000000bb',
            'admin',
          )
        ).status,
      ).toBe(404);
      expect((await call('GET', '/admin/offers/nope', 'admin')).status).toBe(
        400,
      );
    });

    it('suspends a published offer with a reason, recording who and when', async () => {
      await subscribe(venueA1, 5);
      const offer = await createDraft(branchA1);
      await publish(offer.id);

      const res = await call(
        'POST',
        `/admin/offers/${offer.id}/suspend`,
        'admin',
        { reason: '  Uygunsuz içerik  ' },
      );

      expect(res.status).toBe(200);
      const suspended = adminOfferSchema.parse(await res.json());
      expect(suspended.status).toBe('SUSPENDED');
      expect(suspended.suspension).toMatchObject({
        reason: 'Uygunsuz içerik',
        suspendedBy: { id: ids.admin, name: 'admin' },
      });
      expect(Date.parse(suspended.suspension!.suspendedAt)).toBeGreaterThan(
        Date.now() - 5000,
      );
      expect(fake.offers.get(offer.id)).toMatchObject({
        suspendedById: ids.admin,
        suspensionReason: 'Uygunsuz içerik',
      });

      // The owner sees why and when, not which admin.
      const ownerView = await (
        await call('GET', `/offers/mine/${offer.id}`, 'ownerA')
      ).text();
      expect(ownerView).toContain('Uygunsuz içerik');
      expect(ownerView).not.toMatch(/suspendedBy|"admin"/);
    });

    it('requires a reason', async () => {
      await subscribe(venueA1, 5);
      const offer = await createDraft(branchA1);
      await publish(offer.id);
      for (const payload of [
        {},
        { reason: '' },
        { reason: '   ' },
        { reason: 'x'.repeat(501) },
      ]) {
        expect(
          (
            await call(
              'POST',
              `/admin/offers/${offer.id}/suspend`,
              'admin',
              payload,
            )
          ).status,
        ).toBe(400);
      }
      expect(fake.offers.get(offer.id)!.status).toBe('PUBLISHED');
    });

    it('only suspends PUBLISHED offers (409 OFFER_NOT_PUBLISHED), and not twice', async () => {
      await subscribe(venueA1, 5);
      const draft = await createDraft(branchA1);
      const draftRes = await call(
        'POST',
        `/admin/offers/${draft.id}/suspend`,
        'admin',
        { reason: 'x' },
      );
      expect(draftRes.status).toBe(409);
      expect(await errorCode(draftRes)).toBe('OFFER_NOT_PUBLISHED');

      const live = await createDraft(branchA1);
      await publish(live.id);
      expect(
        (
          await call('POST', `/admin/offers/${live.id}/suspend`, 'admin', {
            reason: 'bir',
          })
        ).status,
      ).toBe(200);
      const twice = await call(
        'POST',
        `/admin/offers/${live.id}/suspend`,
        'admin',
        { reason: 'iki' },
      );
      expect(twice.status).toBe(409);
      expect(fake.offers.get(live.id)!.suspensionReason).toBe('bir');
      expect(
        (
          await call(
            'POST',
            '/admin/offers/00000000-0000-4000-8000-0000000000bb/suspend',
            'admin',
            { reason: 'x' },
          )
        ).status,
      ).toBe(404);
    });

    it('ignores a status or admin id sent by the client when suspending', async () => {
      await subscribe(venueA1, 5);
      const offer = await createDraft(branchA1);
      await publish(offer.id);
      await call('POST', `/admin/offers/${offer.id}/suspend`, 'admin', {
        reason: 'x',
        status: 'PUBLISHED',
        suspendedById: ids.ownerA,
      });
      expect(fake.offers.get(offer.id)).toMatchObject({
        status: 'SUSPENDED',
        suspendedById: ids.admin,
      });
    });

    it('frees the quota slot when an offer is suspended', async () => {
      await subscribe(venueA1, 1);
      const first = await createDraft(branchA1);
      const second = await createDraft(branchA1);
      await publish(first.id);
      expect(await errorCode(await publish(second.id))).toBe('QUOTA_EXCEEDED');

      await call('POST', `/admin/offers/${first.id}/suspend`, 'admin', {
        reason: 'Kural ihlali',
      });

      expect((await publish(second.id)).status).toBe(200);
      // And the suspended one can not be brought back by its owner.
      expect(await errorCode(await publish(first.id))).toBe('OFFER_NOT_DRAFT');
    });

    it('has no way to edit an offer’s content, reopen or delete it', async () => {
      const offer = await createDraft(branchA1);
      for (const method of ['PUT', 'PATCH', 'DELETE']) {
        expect(
          (
            await call(method, `/admin/offers/${offer.id}`, 'admin', {
              title: 'x',
            })
          ).status,
        ).toBe(404);
      }
      expect(
        (await call('POST', `/admin/offers/${offer.id}/publish`, 'admin'))
          .status,
      ).toBe(404);
    });
  });

  describe('roles', () => {
    it.each(['admin', 'influencer', 'staff', 'suspendedOwner'] as const)(
      'refuses %s on the owner endpoints',
      async (who) => {
        const offer = await createDraft(branchA1);
        expect(
          (await call('POST', '/offers/mine', who, offerBody(branchA1))).status,
        ).toBe(403);
        expect((await call('GET', '/offers/mine', who)).status).toBe(403);
        expect(
          (await call('GET', `/offers/mine/${offer.id}`, who)).status,
        ).toBe(403);
        expect(
          (await call('PUT', `/offers/mine/${offer.id}`, who, {})).status,
        ).toBe(403);
        expect((await publish(offer.id, who)).status).toBe(403);
      },
    );

    it.each(['ownerA', 'influencer', 'staff'] as const)(
      'refuses %s on the admin endpoints',
      async (who) => {
        const offer = await createDraft(branchA1);
        expect((await call('GET', '/admin/offers', who)).status).toBe(403);
        expect(
          (await call('GET', `/admin/offers/${offer.id}`, who)).status,
        ).toBe(403);
        expect(
          (
            await call('POST', `/admin/offers/${offer.id}/suspend`, who, {
              reason: 'x',
            })
          ).status,
        ).toBe(403);
      },
    );

    it('refuses anonymous callers everywhere', async () => {
      const offer = await createDraft(branchA1);
      expect(
        (await call('POST', '/offers/mine', null, offerBody(branchA1))).status,
      ).toBe(401);
      expect((await call('GET', '/offers/mine', null)).status).toBe(401);
      expect((await publish(offer.id, null)).status).toBe(401);
      expect((await call('GET', '/admin/offers', null)).status).toBe(401);
      expect(
        (
          await call('POST', `/admin/offers/${offer.id}/suspend`, null, {
            reason: 'x',
          })
        ).status,
      ).toBe(401);
    });
  });
});
