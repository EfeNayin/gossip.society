import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  collaborationErrorSchema,
  myCollaborationListSchema,
  myCollaborationSchema,
  receivedCollaborationListSchema,
  receivedCollaborationSchema,
  type UserRole,
} from '@gossip/shared';
import {
  createFakePrisma,
  createSessionWithToken,
  createTestApp,
  makeUser,
  type FakeOffer,
} from '../auth/auth-test-utils.js';
import { CLOCK } from './collaboration.service.js';

// The rules over HTTP with an in-memory Prisma (runs in CI). It covers what a
// request does and what is stored, including the rollback of a failed write. It
// does NOT model concurrency or row locks: those are in the PostgreSQL specs
// (collaborations*.integration.spec.ts).
const DAY = 24 * 3600 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs);
const ids = {
  admin: '00000000-0000-4000-8000-0000000000d1',
  ownerA: '00000000-0000-4000-8000-0000000000d2',
  ownerB: '00000000-0000-4000-8000-0000000000d3',
  infX: '00000000-0000-4000-8000-0000000000d4',
  infY: '00000000-0000-4000-8000-0000000000d5',
  infZ: '00000000-0000-4000-8000-0000000000d6',
  staff: '00000000-0000-4000-8000-0000000000d7',
};
type Who = keyof typeof ids;

describe('collaborations over HTTP', () => {
  let app: INestApplication;
  let baseUrl: string;
  let fake: ReturnType<typeof createFakePrisma>;
  const tokens = new Map<string, string>();
  const clock: { fixed: Date | null } = { fixed: null };
  let venueId: string;
  let branchId: string;
  let sequence = 0;

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
  const apply = (
    who: Who,
    offerId: string,
    extra: Record<string, unknown> = {},
  ) =>
    call('POST', '/collaborations/mine', who, {
      offerId,
      acceptTerms: true,
      ...extra,
    });
  const decide = (who: Who, id: string, what: 'approve' | 'reject') =>
    call('POST', `/collaborations/received/${id}/${what}`, who);
  const code = async (res: Response) =>
    collaborationErrorSchema.parse(await res.json()).code;

  const addVenue = async (owner: Who, name: string, branchCount = 1) => {
    // The fake creates one branch with the venue; the others are added directly.
    const venue = await fake.prisma.venue.create({
      data: {
        name,
        description: null,
        ownerId: ids[owner],
        branches: {
          create: { name: 'Şube 1', city: 'İstanbul', address: 'Adres 1' },
        },
      },
      include: { owner: true, branches: {} },
    });
    const first = [...fake.branches.values()].find(
      (b) => b.venueId === venue.id,
    )!;
    const branchIds = [first.id];
    for (let i = 2; i <= branchCount; i++) {
      const id = randomUUID();
      fake.branches.set(id, {
        ...first,
        id,
        name: `Şube ${i}`,
        address: `Adres ${i}`,
      });
      branchIds.push(id);
    }
    return { venueId: venue.id, branchIds };
  };
  const subscribe = (
    venue: string,
    quota: number,
    startsAt = at(-60 * DAY),
    endsAt = at(60 * DAY),
  ) => {
    const planId = `plan-${fake.plans.size + 1}`;
    fake.plans.set(planId, {
      id: planId,
      name: planId,
      activeOfferQuota: 100,
      monthlyMatchQuota: quota,
    });
    const id = `sub-${fake.subscriptions.size + 1}`;
    fake.subscriptions.set(id, {
      id,
      venueId: venue,
      planId,
      startsAt,
      endsAt,
    });
    return planId;
  };
  const addOffer = (
    branch: string,
    overrides: Partial<FakeOffer> = {},
  ): FakeOffer => {
    const offer: FakeOffer = {
      id: randomUUID(),
      branchId: branch,
      title: `İlan ${++sequence}`,
      description: 'İki kişilik akşam yemeği daveti',
      serviceDescription: 'İki kişilik tadım menüsü',
      serviceValueKurus: 250_000,
      expectedContent: 'Bir reels ve üç story',
      minFollowers: 5000,
      capacity: 5,
      validFrom: at(-DAY),
      validUntil: at(30 * DAY),
      status: 'PUBLISHED',
      publishedAt: at(-DAY),
      suspendedAt: null,
      suspensionReason: null,
      suspendedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    fake.offers.set(offer.id, offer);
    return offer;
  };
  const applied = async (who: Who, offerId: string) => {
    const res = await apply(who, offerId);
    expect(res.status).toBe(201);
    return myCollaborationSchema.parse(await res.json());
  };
  const events = (collaborationId: string) =>
    [...fake.collaborationEvents.values()].filter(
      (e) => e.collaborationId === collaborationId,
    );

  let offer: FakeOffer;

  beforeEach(async () => {
    fake = createFakePrisma();
    clock.fixed = null;
    const accounts: [Who, UserRole][] = [
      ['admin', 'ADMIN'],
      ['ownerA', 'VENUE_OWNER'],
      ['ownerB', 'VENUE_OWNER'],
      ['infX', 'INFLUENCER'],
      ['infY', 'INFLUENCER'],
      ['infZ', 'INFLUENCER'],
      ['staff', 'VENUE_STAFF'],
    ];
    for (const [key, role] of accounts) {
      fake.users.set(
        ids[key],
        makeUser({
          id: ids[key],
          role,
          status: 'ACTIVE',
          name: `Test ${key}`,
          email: `${key}-gizli@kafe.example`,
        }),
      );
    }
    fake.profiles.set(ids.infX, {
      userId: ids.infX,
      city: 'İstanbul',
      bio: 'Yemek içerikleri',
      instagramUsername: 'infx',
    });
    const created = await createTestApp(fake.prisma, (builder) => {
      builder.overrideProvider(CLOCK).useValue(() => clock.fixed ?? new Date());
    });
    app = created.app;
    baseUrl = created.baseUrl;
    const jwt = created.moduleRef.get(JwtService);
    for (const key of Object.keys(ids) as Who[]) {
      tokens.set(
        key,
        (await createSessionWithToken(fake, jwt, ids[key])).accessToken,
      );
    }
    const venue = await addVenue('ownerA', 'Kafe Gizli', 2);
    venueId = venue.venueId;
    branchId = venue.branchIds[0]!;
    subscribe(venueId, 50);
    offer = addOffer(branchId);
  });
  afterEach(() => app.close());

  describe('applying', () => {
    it('creates an APPLIED application, the terms from the offer, and the first history entry', async () => {
      const res = await apply('infX', offer.id, {
        status: 'APPROVED',
        influencerId: ids.infY,
        venueId: 'x',
        terms: { title: 'Sahte', serviceValueKurus: 1 },
        termsAcceptedAt: '2000-01-01T00:00:00Z',
      });

      expect(res.status).toBe(201);
      const body = myCollaborationSchema.parse(await res.json());
      expect(body).toMatchObject({
        status: 'APPLIED',
        decidedAt: null,
        offer: {
          id: offer.id,
          venue: { name: 'Kafe Gizli' },
          branch: { name: 'Şube 1', city: 'İstanbul' },
        },
        terms: {
          title: offer.title,
          serviceValueKurus: 250_000,
          minFollowers: 5000,
          validFrom: offer.validFrom.toISOString(),
        },
        history: [{ fromStatus: null, toStatus: 'APPLIED' }],
      });
      const stored = [...fake.collaborations.values()][0]!;
      expect(stored).toMatchObject({
        offerId: offer.id,
        influencerId: ids.infX,
        venueId,
        status: 'APPLIED',
      });
      expect(stored.termsAcceptedAt.getTime()).toBe(stored.appliedAt.getTime());
      expect(events(stored.id)).toMatchObject([
        { fromStatus: null, toStatus: 'APPLIED', actorId: ids.infX },
      ]);
    });

    it.each([[{}], [{ acceptTerms: false }], [{ acceptTerms: 'true' }]])(
      'refuses a request without an explicit acceptance (%j)',
      async (override) => {
        const res = await call('POST', '/collaborations/mine', 'infX', {
          offerId: offer.id,
          ...override,
        });
        expect(res.status).toBe(400);
        expect(fake.collaborations.size).toBe(0);
      },
    );

    it('a second application is a 409 ALREADY_APPLIED and changes nothing', async () => {
      const first = await applied('infX', offer.id);
      const before = { ...fake.collaborations.get(first.id)! };
      const res = await apply('infX', offer.id);
      expect(res.status).toBe(409);
      expect(await code(res)).toBe('ALREADY_APPLIED');
      expect(fake.collaborations.get(first.id)).toEqual(before);
      expect(events(first.id)).toHaveLength(1);
    });

    it('after a rejection there is no new application', async () => {
      const first = await applied('infX', offer.id);
      await decide('ownerA', first.id, 'reject');
      const res = await apply('infX', offer.id);
      expect(res.status).toBe(409);
      expect(await code(res)).toBe('ALREADY_APPLIED');
      expect(fake.collaborations.size).toBe(1);
    });

    it.each([
      ['a draft', { status: 'DRAFT' as const, publishedAt: null }],
      ['a suspended offer', { status: 'SUSPENDED' as const }],
      [
        'an offer that has not started',
        { validFrom: at(DAY), validUntil: at(2 * DAY) },
      ],
      [
        'an offer that has ended',
        { validFrom: at(-3 * DAY), validUntil: at(-DAY) },
      ],
    ])('answers 404 for %s and stores nothing', async (_n, change) => {
      const hidden = addOffer(branchId, change);
      expect((await apply('infX', hidden.id)).status).toBe(404);
      expect(fake.collaborations.size).toBe(0);
    });

    it('answers 404 for an offer that does not exist', async () => {
      expect((await apply('infX', randomUUID())).status).toBe(404);
    });

    it('the start is inclusive and the end exclusive (clock frozen at the boundary)', async () => {
      const now = new Date('2026-10-15T09:00:00Z');
      clock.fixed = now;
      const startsNow = addOffer(branchId, {
        validFrom: now,
        validUntil: new Date(now.getTime() + DAY),
      });
      const endsNow = addOffer(branchId, {
        validFrom: new Date(now.getTime() - DAY),
        validUntil: now,
      });
      expect((await apply('infX', startsNow.id)).status).toBe(201);
      expect((await apply('infX', endsNow.id)).status).toBe(404);
    });

    it('is for influencers only: 401 without a token, 403 for the other roles', async () => {
      expect(
        (
          await call('POST', '/collaborations/mine', null, {
            offerId: offer.id,
            acceptTerms: true,
          })
        ).status,
      ).toBe(401);
      for (const who of ['ownerA', 'staff', 'admin'] as const) {
        expect((await apply(who, offer.id)).status).toBe(403);
      }
      expect(fake.collaborations.size).toBe(0);
    });

    it('rolls the whole application back when its history entry cannot be written', async () => {
      fake.failures.eventCreate = () => new Error('disk full');
      expect((await apply('infX', offer.id)).status).toBe(500);
      expect(fake.collaborations.size).toBe(0);
      delete fake.failures.eventCreate;
      expect((await apply('infX', offer.id)).status).toBe(201);
    });
  });

  describe('deciding', () => {
    it('approval and rejection write the status, the decider and the history', async () => {
      const a = await applied('infX', offer.id);
      const b = await applied('infY', offer.id);
      const approved = await decide('ownerA', a.id, 'approve');
      const rejected = await decide('ownerA', b.id, 'reject');

      expect(approved.status).toBe(200);
      expect(rejected.status).toBe(200);
      expect(
        receivedCollaborationSchema
          .parse(await approved.json())
          .history.map((h) => [h.fromStatus, h.toStatus]),
      ).toEqual([
        [null, 'APPLIED'],
        ['APPLIED', 'APPROVED'],
      ]);
      expect(fake.collaborations.get(a.id)).toMatchObject({
        status: 'APPROVED',
        decidedById: ids.ownerA,
      });
      expect(fake.collaborations.get(a.id)!.approvedAt).not.toBeNull();
      expect(fake.collaborations.get(b.id)).toMatchObject({
        status: 'REJECTED',
        decidedById: ids.ownerA,
        approvedAt: null,
      });
      expect(
        events(b.id).map((e) => [e.fromStatus, e.toStatus, e.actorId]),
      ).toEqual([
        [null, 'APPLIED', ids.infY],
        ['APPLIED', 'REJECTED', ids.ownerA],
      ]);
    });

    it('the same decision again is a 200 without a new event; the opposite one is a 409', async () => {
      const a = await applied('infX', offer.id);
      const b = await applied('infY', offer.id);
      await decide('ownerA', a.id, 'approve');
      await decide('ownerA', b.id, 'reject');
      const approvedAt = fake.collaborations.get(a.id)!.approvedAt;

      expect((await decide('ownerA', a.id, 'approve')).status).toBe(200);
      expect((await decide('ownerA', b.id, 'reject')).status).toBe(200);
      expect(fake.collaborations.get(a.id)!.approvedAt).toEqual(approvedAt);
      expect(events(a.id)).toHaveLength(2);
      expect(events(b.id)).toHaveLength(2);

      const rejectApproved = await decide('ownerA', a.id, 'reject');
      const approveRejected = await decide('ownerA', b.id, 'approve');
      expect(rejectApproved.status).toBe(409);
      expect(await code(rejectApproved)).toBe('COLLABORATION_ALREADY_APPROVED');
      expect(approveRejected.status).toBe(409);
      expect(await code(approveRejected)).toBe(
        'COLLABORATION_ALREADY_REJECTED',
      );
      expect(events(a.id)).toHaveLength(2);
      expect(events(b.id)).toHaveLength(2);
    });

    it('ignores an owner id, status or events sent by the client', async () => {
      const a = await applied('infX', offer.id);
      const res = await call(
        'POST',
        `/collaborations/received/${a.id}/reject`,
        'ownerA',
        {
          ownerId: ids.ownerB,
          status: 'APPROVED',
          decidedById: ids.ownerB,
        },
      );
      expect(res.status).toBe(200);
      expect(fake.collaborations.get(a.id)).toMatchObject({
        status: 'REJECTED',
        decidedById: ids.ownerA,
      });
    });

    it('a rejection works on an offer that is no longer visible; an approval does not', async () => {
      const a = await applied('infX', offer.id);
      const b = await applied('infY', offer.id);
      fake.offers.get(offer.id)!.status = 'SUSPENDED';
      const approve = await decide('ownerA', a.id, 'approve');
      expect(approve.status).toBe(409);
      expect(await code(approve)).toBe('OFFER_NOT_OPEN');
      expect(fake.collaborations.get(a.id)!.status).toBe('APPLIED');
      expect(events(a.id)).toHaveLength(1);
      expect((await decide('ownerA', b.id, 'reject')).status).toBe(200);
    });

    it('needs a subscription that is valid now', async () => {
      const a = await applied('infX', offer.id);
      for (const period of [
        null,
        [at(-30 * DAY), at(-DAY)],
        [at(DAY), at(30 * DAY)],
      ] as const) {
        fake.subscriptions.clear();
        if (period) subscribe(venueId, 10, period[0], period[1]);
        const res = await decide('ownerA', a.id, 'approve');
        expect(res.status).toBe(409);
        expect(await code(res)).toBe('NO_ACTIVE_SUBSCRIPTION');
      }
      expect(fake.collaborations.get(a.id)!.status).toBe('APPLIED');
    });

    it.each([
      ['suspended', { status: 'SUSPENDED' as const }],
      ['no longer an influencer', { role: 'VENUE_OWNER' as const }],
    ])(
      'an applicant who is %s cannot be approved but can be rejected',
      async (_n, change) => {
        const a = await applied('infX', offer.id);
        Object.assign(fake.users.get(ids.infX)!, change);
        const res = await decide('ownerA', a.id, 'approve');
        expect(res.status).toBe(409);
        expect(await code(res)).toBe('APPLICANT_NOT_ELIGIBLE');
        expect(fake.collaborations.get(a.id)).toMatchObject({
          status: 'APPLIED',
          approvedAt: null,
        });
        expect((await decide('ownerA', a.id, 'reject')).status).toBe(200);
      },
    );

    it('capacity: APPLIED holds no place; approvals stop at the capacity', async () => {
      const small = addOffer(branchId, { capacity: 2 });
      const rows = [
        await applied('infX', small.id),
        await applied('infY', small.id),
        await applied('infZ', small.id),
      ];
      expect(fake.collaborations.size).toBe(3);
      expect((await decide('ownerA', rows[0]!.id, 'approve')).status).toBe(200);
      expect((await decide('ownerA', rows[1]!.id, 'approve')).status).toBe(200);
      const third = await decide('ownerA', rows[2]!.id, 'approve');
      expect(third.status).toBe(409);
      expect(await code(third)).toBe('OFFER_CAPACITY_FULL');
      expect(events(rows[2]!.id)).toHaveLength(1);
    });

    it('the monthly quota is the venue’s, across offers and branches; a rejection uses none', async () => {
      const other = await addVenue('ownerA', 'Bar', 2);
      subscribe(other.venueId, 2);
      const offers = [
        addOffer(other.branchIds[0]!),
        addOffer(other.branchIds[1]!),
        addOffer(other.branchIds[0]!),
      ];
      const rows = [];
      for (const o of offers) rows.push(await applied('infX', o.id));
      const rejectedOne = await applied('infY', offers[0]!.id);
      await decide('ownerA', rejectedOne.id, 'reject');

      expect((await decide('ownerA', rows[0]!.id, 'approve')).status).toBe(200);
      expect((await decide('ownerA', rows[1]!.id, 'approve')).status).toBe(200);
      const res = await decide('ownerA', rows[2]!.id, 'approve');
      expect(res.status).toBe(409);
      expect(await code(res)).toBe('MONTHLY_QUOTA_EXCEEDED');
      expect(fake.collaborations.get(rows[2]!.id)).toMatchObject({
        status: 'APPLIED',
        approvedAt: null,
      });
      expect(events(rows[2]!.id)).toHaveLength(1);
    });

    describe('the Istanbul month', () => {
      // Inserts already APPROVED collaborations of this venue at the given instants.
      const approvedAt = (instants: string[]) => {
        for (const instant of instants) {
          const o = addOffer(branchId, {
            validFrom: new Date('2026-09-01T00:00:00Z'),
            validUntil: new Date('2026-12-01T00:00:00Z'),
          });
          const when = new Date(instant);
          fake.collaborations.set(randomUUID(), {
            id: randomUUID(),
            offerId: o.id,
            influencerId: ids.infY,
            venueId,
            status: 'APPROVED',
            appliedAt: new Date(when.getTime() - 3600_000),
            termsAcceptedAt: when,
            termsSnapshot: {},
            decidedAt: when,
            decidedById: ids.ownerA,
            approvedAt: when,
            createdAt: when,
            updatedAt: when,
          });
        }
      };
      const target = () =>
        addOffer(branchId, {
          validFrom: new Date('2026-09-01T00:00:00Z'),
          validUntil: new Date('2026-12-31T00:00:00Z'),
        });
      beforeEach(() => {
        clock.fixed = new Date('2026-10-15T09:00:00Z');
        fake.subscriptions.clear();
      });

      it('counts from 00:00 on the 1st in Istanbul to its last millisecond, and nothing outside', async () => {
        subscribe(
          venueId,
          3,
          new Date('2026-01-01T00:00:00Z'),
          new Date('2027-01-01T00:00:00Z'),
        );
        approvedAt([
          '2026-09-30T20:59:59.999Z',
          '2026-09-30T21:00:00.000Z',
          '2026-10-31T20:59:59.999Z',
          '2026-10-31T21:00:00.000Z',
        ]);
        const a = await applied('infX', target().id);
        const b = await applied('infZ', target().id);
        expect((await decide('ownerA', a.id, 'approve')).status).toBe(200); // 2 counted of 3
        expect(await code(await decide('ownerA', b.id, 'approve'))).toBe(
          'MONTHLY_QUOTA_EXCEEDED',
        );
      });

      it.each([
        [
          '00:00 Istanbul on the 1st is October already (still 30 September in UTC)',
          '2026-09-30T21:00:00.000Z',
          409,
        ],
        [
          '00:00 Istanbul on 1 November is not October (still 31 October in UTC)',
          '2026-10-31T21:00:00.000Z',
          200,
        ],
      ])('%s', async (_n, instant, expected) => {
        subscribe(
          venueId,
          1,
          new Date('2026-01-01T00:00:00Z'),
          new Date('2027-01-01T00:00:00Z'),
        );
        approvedAt([instant]);
        const a = await applied('infX', target().id);
        expect((await decide('ownerA', a.id, 'approve')).status).toBe(expected);
      });

      it('a subscription change inside the month keeps the same count; the limit is the current plan’s', async () => {
        subscribe(
          venueId,
          10,
          new Date('2026-01-01T00:00:00Z'),
          new Date('2026-10-10T00:00:00Z'),
        );
        const planB = subscribe(
          venueId,
          3,
          new Date('2026-10-10T00:00:00Z'),
          new Date('2027-01-01T00:00:00Z'),
        );
        approvedAt(['2026-10-03T09:00:00Z', '2026-10-05T09:00:00Z']);
        const a = await applied('infX', target().id);
        const b = await applied('infZ', target().id);
        expect((await decide('ownerA', a.id, 'approve')).status).toBe(200);
        expect(await code(await decide('ownerA', b.id, 'approve'))).toBe(
          'MONTHLY_QUOTA_EXCEEDED',
        );
        fake.plans.get(planB)!.monthlyMatchQuota = 4;
        expect((await decide('ownerA', b.id, 'approve')).status).toBe(200);
      });

      it('the next month starts with a new count', async () => {
        subscribe(
          venueId,
          1,
          new Date('2026-01-01T00:00:00Z'),
          new Date('2027-01-01T00:00:00Z'),
        );
        approvedAt(['2026-10-20T09:00:00.000Z']);
        const a = await applied('infX', target().id);
        expect(await code(await decide('ownerA', a.id, 'approve'))).toBe(
          'MONTHLY_QUOTA_EXCEEDED',
        );
        clock.fixed = new Date('2026-10-31T21:00:00.000Z');
        expect((await decide('ownerA', a.id, 'approve')).status).toBe(200);
      });
    });

    it('rolls the approval back when its history entry cannot be written: still APPLIED, no quota used', async () => {
      const tight = await addVenue('ownerA', 'Dar');
      subscribe(tight.venueId, 1);
      const o = addOffer(tight.branchIds[0]!, { capacity: 1 });
      const a = await applied('infX', o.id);
      fake.failures.eventCreate = (e) =>
        e.toStatus === 'APPROVED' ? new Error('disk full') : undefined;

      expect((await decide('ownerA', a.id, 'approve')).status).toBe(500);
      expect(fake.collaborations.get(a.id)).toMatchObject({
        status: 'APPLIED',
        approvedAt: null,
        decidedAt: null,
        decidedById: null,
      });
      expect(events(a.id)).toHaveLength(1);

      delete fake.failures.eventCreate;
      expect((await decide('ownerA', a.id, 'approve')).status).toBe(200); // quota and capacity were not used
    });

    it('rolls the rejection back when its history entry cannot be written', async () => {
      const a = await applied('infX', offer.id);
      fake.failures.eventCreate = (e) =>
        e.toStatus === 'REJECTED' ? new Error('disk full') : undefined;
      expect((await decide('ownerA', a.id, 'reject')).status).toBe(500);
      expect(fake.collaborations.get(a.id)).toMatchObject({
        status: 'APPLIED',
        decidedAt: null,
        decidedById: null,
      });
      expect(events(a.id)).toHaveLength(1);
    });
  });

  describe('reading, isolation and what leaks', () => {
    it('a venue owner reads only the applications to their own offers', async () => {
      const mine = await applied('infX', offer.id);
      const foreign = await addVenue('ownerB', 'Başka');
      subscribe(foreign.venueId, 10);
      const theirs = await applied('infY', addOffer(foreign.branchIds[0]!).id);

      const list = receivedCollaborationListSchema.parse(
        await (
          await call('GET', '/collaborations/received?pageSize=50', 'ownerA')
        ).json(),
      );
      expect(list.items.map((i) => i.id)).toEqual([mine.id]);
      expect(
        (await call('GET', `/collaborations/received/${theirs.id}`, 'ownerA'))
          .status,
      ).toBe(404);
      expect((await decide('ownerA', theirs.id, 'approve')).status).toBe(404);
      expect((await decide('ownerA', theirs.id, 'reject')).status).toBe(404);
      expect(fake.collaborations.get(theirs.id)!.status).toBe('APPLIED');
    });

    it('an influencer reads only their own applications', async () => {
      const x = await applied('infX', offer.id);
      expect(
        (await call('GET', `/collaborations/mine/${x.id}`, 'infY')).status,
      ).toBe(404);
      expect(
        (await call('GET', `/collaborations/mine/${x.id}`, 'infX')).status,
      ).toBe(200);
      const list = myCollaborationListSchema.parse(
        await (await call('GET', '/collaborations/mine', 'infY')).json(),
      );
      expect(list.items).toEqual([]);
    });

    it('roles are enforced on every endpoint', async () => {
      const x = await applied('infX', offer.id);
      for (const [method, path, who] of [
        ['GET', '/collaborations/mine', 'ownerA'],
        ['GET', `/collaborations/mine/${x.id}`, 'ownerA'],
        ['GET', '/collaborations/received', 'infX'],
        ['GET', `/collaborations/received/${x.id}`, 'infX'],
        ['POST', `/collaborations/received/${x.id}/approve`, 'infX'],
        ['POST', `/collaborations/received/${x.id}/reject`, 'infX'],
        ['GET', '/collaborations/received', 'admin'],
        ['GET', '/collaborations/mine', 'staff'],
      ] as const) {
        expect(
          (await call(method, path, who)).status,
          `${method} ${path} as ${who}`,
        ).toBe(403);
      }
      expect((await call('GET', '/collaborations/received', null)).status).toBe(
        401,
      );
    });

    it('the owner sees a basic applicant profile and never an e-mail, hash, role or id', async () => {
      const x = await applied('infX', offer.id);
      const text = await (
        await call('GET', `/collaborations/received/${x.id}`, 'ownerA')
      ).text();
      const parsed = receivedCollaborationSchema.parse(JSON.parse(text));
      expect(parsed.applicant).toEqual({
        name: 'Test infX',
        profile: {
          city: 'İstanbul',
          bio: 'Yemek içerikleri',
          instagramUsername: 'infx',
        },
      });
      expect(text).not.toMatch(
        /gizli@|passwordHash|argon|"email"|"role"|"status":"ACTIVE"|followerCount|"score"|rating|verified/i,
      );
      for (const secret of [ids.infX, ids.ownerA, venueId])
        expect(text).not.toContain(secret);
    });

    it('an applicant without a profile has a null profile, nothing invented', async () => {
      const y = await applied('infY', offer.id);
      const parsed = receivedCollaborationSchema.parse(
        await (
          await call('GET', `/collaborations/received/${y.id}`, 'ownerA')
        ).json(),
      );
      expect(parsed.applicant.profile).toBeNull();
    });

    it('the influencer’s view carries no owner e-mail, user ids or subscription', async () => {
      const x = await applied('infX', offer.id);
      const text = await (
        await call('GET', `/collaborations/mine/${x.id}`, 'infX')
      ).text();
      expect(text).not.toMatch(
        /gizli@|passwordHash|argon|plan|subscription|ownerId|venueId/i,
      );
      for (const secret of [venueId, ids.ownerA, branchId])
        expect(text).not.toContain(secret);
    });

    it('lists page without repeats or gaps, newest first, with status and offer filters', async () => {
      const offers = [offer, addOffer(branchId), addOffer(branchId)];
      const mine = [];
      for (const o of offers) mine.push((await applied('infX', o.id)).id);
      await decide('ownerA', mine[0]!, 'reject');

      const seen: string[] = [];
      for (let page = 1; page <= 3; page++) {
        const list = myCollaborationListSchema.parse(
          await (
            await call(
              'GET',
              `/collaborations/mine?page=${page}&pageSize=1`,
              'infX',
            )
          ).json(),
        );
        expect(list).toMatchObject({ total: 3, totalPages: 3 });
        seen.push(...list.items.map((i) => i.id));
      }
      expect(seen).toEqual([...mine].reverse());
      expect(
        myCollaborationListSchema
          .parse(
            await (
              await call('GET', '/collaborations/mine?status=REJECTED', 'infX')
            ).json(),
          )
          .items.map((i) => i.id),
      ).toEqual([mine[0]]);
      expect(
        receivedCollaborationListSchema
          .parse(
            await (
              await call(
                'GET',
                `/collaborations/received?offerId=${offers[1]!.id}`,
                'ownerA',
              )
            ).json(),
          )
          .items.map((i) => i.id),
      ).toEqual([mine[1]]);
      for (const bad of [
        'pageSize=51',
        'page=0',
        'status=CANCELLED',
        'offerId=x',
      ]) {
        expect(
          (await call('GET', `/collaborations/received?${bad}`, 'ownerA'))
            .status,
        ).toBe(400);
      }
    });

    it('ignores an influencer or owner id sent in the query', async () => {
      await applied('infX', offer.id);
      const mine = await call(
        'GET',
        `/collaborations/mine?influencerId=${ids.infX}`,
        'infY',
      );
      expect(myCollaborationListSchema.parse(await mine.json()).items).toEqual(
        [],
      );
      const received = await call(
        'GET',
        `/collaborations/received?ownerId=${ids.ownerA}`,
        'ownerB',
      );
      expect(
        receivedCollaborationListSchema.parse(await received.json()).items,
      ).toEqual([]);
    });
  });
});
