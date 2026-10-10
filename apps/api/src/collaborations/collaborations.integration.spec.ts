import {
  collaborationErrorSchema,
  myCollaborationListSchema,
  myCollaborationSchema,
  receivedCollaborationListSchema,
  receivedCollaborationSchema,
} from '@gossip/shared';
import { createKit, DAY, at, type Kit } from './collaboration-test-kit.js';

// Applications and decisions against the real PostgreSQL: the business rules
// and what is stored. The races (locks, order of transactions) are in
// collaborations-locking.integration.spec.ts.
describe('collaborations against PostgreSQL', () => {
  let kit: Kit;
  const { request } = {
    request: (...args: Parameters<Kit['request']>) => kit.request(...args),
  };
  let venueId: string;
  let branchIds: string[];
  let offerId: string;

  const apply = (
    who: string,
    id: string,
    extra: Record<string, unknown> = {},
  ) =>
    request('POST', '/collaborations/mine', who, {
      offerId: id,
      acceptTerms: true,
      ...extra,
    });
  const applied = async (who: string, id = offerId) => {
    const res = await apply(who, id);
    expect(res.status).toBe(201);
    return myCollaborationSchema.parse(await res.json());
  };
  const decide = (who: string, id: string, what: 'approve' | 'reject') =>
    request('POST', `/collaborations/received/${id}/${what}`, who);
  const code = async (res: Response) =>
    collaborationErrorSchema.parse(await res.json()).code;
  const row = (id: string) =>
    kit.prisma.collaboration.findUniqueOrThrow({ where: { id } });
  const countRows = (where: Record<string, unknown>) =>
    kit.prisma.collaboration.count({ where });

  beforeAll(async () => {
    kit = await createKit('collab');
    await kit.makeUser('ownerA', 'VENUE_OWNER');
    await kit.makeUser('ownerB', 'VENUE_OWNER');
    await kit.makeUser('infX', 'INFLUENCER', { profile: true });
    await kit.makeUser('infY', 'INFLUENCER');
    await kit.makeUser('infZ', 'INFLUENCER');
    await kit.makeUser('staff', 'VENUE_STAFF');
    await kit.makeUser('admin', 'ADMIN');
  });
  afterAll(() => kit.close());

  // A fresh venue (two branches, a generous subscription) and one open offer per test.
  beforeEach(async () => {
    kit.clock.fixed = null;
    const venue = await kit.makeVenue(
      'ownerA',
      `v-${Math.random().toString(36).slice(2, 8)}`,
      2,
    );
    venueId = venue.venueId;
    branchIds = venue.branchIds;
    await kit.subscribe(venueId, 50);
    offerId = (await kit.makeOffer(branchIds[0]!)).id;
  });

  describe('applying', () => {
    it('creates an APPLIED application with the terms copied from the offer on the server', async () => {
      const offer = await kit.prisma.offer.findUniqueOrThrow({
        where: { id: offerId },
      });
      // The client "sends" other terms, a status, someone else's id: all ignored.
      const res = await apply('infX', offerId, {
        status: 'APPROVED',
        influencerId: kit.userIds.get('infY'),
        venueId: 'x',
        terms: { title: 'Sahte', serviceValueKurus: 1, minFollowers: 0 },
        termsAcceptedAt: '2000-01-01T00:00:00Z',
        appliedAt: '2000-01-01T00:00:00Z',
      });

      expect(res.status).toBe(201);
      const body = myCollaborationSchema.parse(await res.json());
      expect(body.status).toBe('APPLIED');
      expect(body.decidedAt).toBeNull();
      expect(body.terms).toEqual({
        title: offer.title,
        serviceDescription: offer.serviceDescription,
        serviceValueKurus: 250_000,
        expectedContent: offer.expectedContent,
        minFollowers: 5000,
        validFrom: offer.validFrom.toISOString(),
        validUntil: offer.validUntil.toISOString(),
      });
      expect(body.termsAcceptedAt).toBe(body.appliedAt);
      expect(Date.now() - Date.parse(body.appliedAt)).toBeLessThan(10_000);

      const stored = await row(body.id);
      expect(stored).toMatchObject({
        offerId,
        influencerId: kit.userIds.get('infX'),
        venueId,
        status: 'APPLIED',
        decidedAt: null,
        decidedById: null,
        approvedAt: null,
      });
      expect(stored.termsAcceptedAt.toISOString()).toBe(body.termsAcceptedAt);
      expect(await kit.events(body.id)).toMatchObject([
        {
          fromStatus: null,
          toStatus: 'APPLIED',
          actorId: kit.userIds.get('infX'),
        },
      ]);
    });

    it('the stored terms are a snapshot: a later change of the offer does not change them', async () => {
      const first = await applied('infX');
      await kit.prisma.offer.update({
        where: { id: offerId },
        data: { serviceValueKurus: 999_999, title: 'Değişti' },
      });
      const read = myCollaborationSchema.parse(
        await (
          await request('GET', `/collaborations/mine/${first.id}`, 'infX')
        ).json(),
      );
      expect(read.terms.serviceValueKurus).toBe(250_000);
      expect(read.terms.title).not.toBe('Değişti');
    });

    it.each([
      ['no acceptance', {}],
      ['acceptTerms false', { acceptTerms: false }],
      ['acceptTerms as a string', { acceptTerms: 'true' }],
    ])('refuses %s with 400 and stores nothing', async (_n, override) => {
      const res = await request('POST', '/collaborations/mine', 'infX', {
        offerId,
        ...(Object.keys(override).length === 0 ? {} : override),
      });
      expect(res.status).toBe(400);
      expect(await countRows({ offerId })).toBe(0);
    });

    it('a second application is a 409 ALREADY_APPLIED that changes nothing', async () => {
      const first = await applied('infX');
      const before = await row(first.id);
      const res = await apply('infX', offerId);
      expect(res.status).toBe(409);
      expect(await code(res)).toBe('ALREADY_APPLIED');
      expect(await row(first.id)).toEqual(before);
      expect(await kit.events(first.id)).toHaveLength(1);
      expect(await countRows({ offerId })).toBe(1);
    });

    it('after a rejection the influencer cannot apply again', async () => {
      const first = await applied('infX');
      expect((await decide('ownerA', first.id, 'reject')).status).toBe(200);
      const res = await apply('infX', offerId);
      expect(res.status).toBe(409);
      expect(await code(res)).toBe('ALREADY_APPLIED');
      expect((await row(first.id)).status).toBe('REJECTED');
      expect(await countRows({ offerId })).toBe(1);
    });

    it('different influencers can apply to the same offer', async () => {
      await applied('infX');
      await applied('infY');
      expect(await countRows({ offerId })).toBe(2);
    });

    it.each([
      ['a draft', { status: 'DRAFT', publishedAt: null }],
      ['a suspended offer', { status: 'SUSPENDED' }],
      [
        'an offer that has not started',
        { validFrom: at(DAY), validUntil: at(2 * DAY) },
      ],
      [
        'an offer that has ended',
        { validFrom: at(-3 * DAY), validUntil: at(-DAY) },
      ],
    ] as [string, Record<string, unknown>][])(
      'refuses %s with 404 and stores nothing',
      async (_n, change) => {
        const admin = await kit.prisma.user.findFirstOrThrow({
          where: { email: kit.email('admin') },
        });
        const hidden = await kit.makeOffer(branchIds[0]!, {
          ...change,
          ...(change.status === 'SUSPENDED'
            ? {
                suspendedAt: new Date(),
                suspensionReason: 'sebep',
                suspendedById: admin.id,
              }
            : {}),
        });
        expect((await apply('infX', hidden.id)).status).toBe(404);
        expect(await countRows({ offerId: hidden.id })).toBe(0);
      },
    );

    it('an unknown offer is a 404', async () => {
      expect(
        (await apply('infX', '00000000-0000-4000-8000-0000000000aa')).status,
      ).toBe(404);
    });

    it('only an influencer may apply (401 / 403 otherwise)', async () => {
      expect(
        (
          await request('POST', '/collaborations/mine', null, {
            offerId,
            acceptTerms: true,
          })
        ).status,
      ).toBe(401);
      for (const who of ['ownerA', 'staff', 'admin']) {
        expect((await apply(who, offerId)).status).toBe(403);
      }
      expect(await countRows({ offerId })).toBe(0);
    });

    it('an influencer suspended after signing in is refused', async () => {
      await kit.makeUser(
        `late-${Math.random().toString(36).slice(2, 6)}`,
        'INFLUENCER',
      );
      const who = [...kit.userIds.keys()].at(-1)!;
      await kit.prisma.user.update({
        where: { id: kit.userIds.get(who)! },
        data: { status: 'SUSPENDED' },
      });
      expect((await apply(who, offerId)).status).toBe(403);
      expect(await countRows({ offerId })).toBe(0);
    });
  });

  describe('deciding', () => {
    it('application -> approval: APPROVED with the decider, the times and the right history', async () => {
      const first = await applied('infX');
      const res = await decide('ownerA', first.id, 'approve');

      expect(res.status).toBe(200);
      const body = receivedCollaborationSchema.parse(await res.json());
      expect(body.status).toBe('APPROVED');
      expect(body.decidedAt).not.toBeNull();
      expect(body.history.map((h) => [h.fromStatus, h.toStatus])).toEqual([
        [null, 'APPLIED'],
        ['APPLIED', 'APPROVED'],
      ]);
      const stored = await row(first.id);
      expect(stored).toMatchObject({
        status: 'APPROVED',
        decidedById: kit.userIds.get('ownerA'),
      });
      expect(stored.approvedAt).not.toBeNull();
      expect(stored.approvedAt!.getTime()).toBe(stored.decidedAt!.getTime());
      const events = await kit.events(first.id);
      expect(events.map((e) => [e.fromStatus, e.toStatus, e.actorId])).toEqual([
        [null, 'APPLIED', kit.userIds.get('infX')],
        ['APPLIED', 'APPROVED', kit.userIds.get('ownerA')],
      ]);
    });

    it('application -> rejection: REJECTED, no approvedAt, the right history', async () => {
      const first = await applied('infX');
      const res = await decide('ownerA', first.id, 'reject');

      expect(res.status).toBe(200);
      expect(receivedCollaborationSchema.parse(await res.json()).status).toBe(
        'REJECTED',
      );
      const stored = await row(first.id);
      expect(stored).toMatchObject({
        status: 'REJECTED',
        decidedById: kit.userIds.get('ownerA'),
        approvedAt: null,
      });
      expect(stored.decidedAt).not.toBeNull();
      expect(
        (await kit.events(first.id)).map((e) => [e.fromStatus, e.toStatus]),
      ).toEqual([
        [null, 'APPLIED'],
        ['APPLIED', 'REJECTED'],
      ]);
    });

    it('the same decision again is a 200 that adds no event and uses no quota', async () => {
      const a = await applied('infX');
      const b = await applied('infY');
      await decide('ownerA', a.id, 'approve');
      await decide('ownerA', b.id, 'reject');
      const approvedAt = (await row(a.id)).approvedAt;

      expect((await decide('ownerA', a.id, 'approve')).status).toBe(200);
      expect((await decide('ownerA', b.id, 'reject')).status).toBe(200);

      expect((await row(a.id)).approvedAt).toEqual(approvedAt);
      expect(await kit.events(a.id)).toHaveLength(2);
      expect(await kit.events(b.id)).toHaveLength(2);
      expect(await countRows({ venueId, status: 'APPROVED' })).toBe(1);
    });

    it('the opposite decision is a 409 and changes nothing', async () => {
      const a = await applied('infX');
      const b = await applied('infY');
      await decide('ownerA', a.id, 'approve');
      await decide('ownerA', b.id, 'reject');

      const rejectApproved = await decide('ownerA', a.id, 'reject');
      const approveRejected = await decide('ownerA', b.id, 'approve');

      expect(rejectApproved.status).toBe(409);
      expect(await code(rejectApproved)).toBe('COLLABORATION_ALREADY_APPROVED');
      expect(approveRejected.status).toBe(409);
      expect(await code(approveRejected)).toBe(
        'COLLABORATION_ALREADY_REJECTED',
      );
      expect((await row(a.id)).status).toBe('APPROVED');
      expect((await row(b.id)).status).toBe('REJECTED');
      expect(await kit.events(a.id)).toHaveLength(2);
      expect(await kit.events(b.id)).toHaveLength(2);
    });

    it('ignores an owner id, status or event sent by the client', async () => {
      const a = await applied('infX');
      const res = await request(
        'POST',
        `/collaborations/received/${a.id}/reject`,
        'ownerA',
        {
          ownerId: kit.userIds.get('ownerB'),
          status: 'APPROVED',
          decidedById: kit.userIds.get('ownerB'),
          events: [{ toStatus: 'APPROVED' }],
        },
      );
      expect(res.status).toBe(200);
      expect(await row(a.id)).toMatchObject({
        status: 'REJECTED',
        decidedById: kit.userIds.get('ownerA'),
      });
      expect(await kit.events(a.id)).toHaveLength(2);
    });

    it('an application to an offer that is no longer visible can still be rejected, but not approved', async () => {
      const a = await applied('infX');
      const b = await applied('infY');
      await kit.prisma.offer.update({
        where: { id: offerId },
        data: { validUntil: at(-1000), validFrom: at(-DAY) },
      });

      const approve = await decide('ownerA', a.id, 'approve');
      expect(approve.status).toBe(409);
      expect(await code(approve)).toBe('OFFER_NOT_OPEN');
      expect((await row(a.id)).status).toBe('APPLIED');
      expect(await kit.events(a.id)).toHaveLength(1);

      expect((await decide('ownerA', b.id, 'reject')).status).toBe(200);
      expect((await row(b.id)).status).toBe('REJECTED');
    });

    it('a suspended offer: approval is refused, rejection works', async () => {
      const a = await applied('infX');
      const admin = await kit.prisma.user.findFirstOrThrow({
        where: { email: kit.email('admin') },
      });
      await kit.prisma.offer.update({
        where: { id: offerId },
        data: {
          status: 'SUSPENDED',
          suspendedAt: new Date(),
          suspensionReason: 'sebep',
          suspendedById: admin.id,
        },
      });
      expect(await code(await decide('ownerA', a.id, 'approve'))).toBe(
        'OFFER_NOT_OPEN',
      );
      expect((await decide('ownerA', a.id, 'reject')).status).toBe(200);
    });

    it('needs a subscription that is valid now (none, expired, not started)', async () => {
      const fresh = await kit.makeVenue(
        'ownerA',
        `ns-${Math.random().toString(36).slice(2, 6)}`,
      );
      const offer = await kit.makeOffer(fresh.branchIds[0]!);
      const a = await applied('infX', offer.id);

      for (const period of [
        null,
        [at(-30 * DAY), at(-DAY)] as const,
        [at(DAY), at(30 * DAY)] as const,
      ]) {
        await kit.prisma.subscription.deleteMany({
          where: { venueId: fresh.venueId },
        });
        if (period)
          await kit.subscribe(fresh.venueId, 10, period[0], period[1]);
        const res = await decide('ownerA', a.id, 'approve');
        expect(res.status).toBe(409);
        expect(await code(res)).toBe('NO_ACTIVE_SUBSCRIPTION');
      }
      expect((await row(a.id)).status).toBe('APPLIED');
      expect(await kit.events(a.id)).toHaveLength(1);
    });

    it.each([
      ['suspended', { status: 'SUSPENDED' as const }],
      ['no longer an influencer', { role: 'VENUE_OWNER' as const }],
    ])(
      'an applicant who is %s cannot be approved, but can be rejected',
      async (_n, change) => {
        const who = `cand-${Math.random().toString(36).slice(2, 6)}`;
        await kit.makeUser(who, 'INFLUENCER');
        const a = await applied(who);
        await kit.prisma.user.update({
          where: { id: kit.userIds.get(who)! },
          data: change,
        });

        const res = await decide('ownerA', a.id, 'approve');
        expect(res.status).toBe(409);
        expect(await code(res)).toBe('APPLICANT_NOT_ELIGIBLE');
        expect(await row(a.id)).toMatchObject({
          status: 'APPLIED',
          approvedAt: null,
        });
        expect(await kit.events(a.id)).toHaveLength(1);
        expect((await decide('ownerA', a.id, 'reject')).status).toBe(200);
      },
    );

    it('capacity: approvals stop at the capacity, and APPLIED holds no place', async () => {
      const small = await kit.makeOffer(branchIds[0]!, { capacity: 2 });
      const people = ['infX', 'infY', 'infZ'];
      const ids: string[] = [];
      for (const who of people) ids.push((await applied(who, small.id)).id);
      // Three applications for two places: nothing is reserved yet.
      expect(await countRows({ offerId: small.id, status: 'APPLIED' })).toBe(3);

      expect((await decide('ownerA', ids[0]!, 'approve')).status).toBe(200);
      expect((await decide('ownerA', ids[1]!, 'approve')).status).toBe(200);
      const third = await decide('ownerA', ids[2]!, 'approve');
      expect(third.status).toBe(409);
      expect(await code(third)).toBe('OFFER_CAPACITY_FULL');
      expect((await row(ids[2]!)).status).toBe('APPLIED');
      expect(await kit.events(ids[2]!)).toHaveLength(1);
      expect(await countRows({ offerId: small.id, status: 'APPROVED' })).toBe(
        2,
      );
    });

    it('the monthly quota is the venue’s: approvals on different offers and branches count together', async () => {
      const other = await kit.makeVenue(
        'ownerA',
        `q-${Math.random().toString(36).slice(2, 6)}`,
        2,
      );
      await kit.subscribe(other.venueId, 2);
      const o1 = await kit.makeOffer(other.branchIds[0]!);
      const o2 = await kit.makeOffer(other.branchIds[1]!);
      const o3 = await kit.makeOffer(other.branchIds[0]!);
      const a = await applied('infX', o1.id);
      const b = await applied('infX', o2.id);
      const c = await applied('infX', o3.id);

      expect((await decide('ownerA', a.id, 'approve')).status).toBe(200);
      expect((await decide('ownerA', b.id, 'approve')).status).toBe(200);
      const res = await decide('ownerA', c.id, 'approve');
      expect(res.status).toBe(409);
      expect(await code(res)).toBe('MONTHLY_QUOTA_EXCEEDED');
      expect(await kit.events(c.id)).toHaveLength(1);
      expect((await row(c.id)).approvedAt).toBeNull();
    });

    it('a rejection uses no quota and no capacity', async () => {
      const tight = await kit.makeVenue(
        'ownerA',
        `r-${Math.random().toString(36).slice(2, 6)}`,
      );
      await kit.subscribe(tight.venueId, 1);
      const offer = await kit.makeOffer(tight.branchIds[0]!, { capacity: 1 });
      const a = await applied('infX', offer.id);
      const b = await applied('infY', offer.id);
      expect((await decide('ownerA', a.id, 'reject')).status).toBe(200);
      expect((await decide('ownerA', b.id, 'approve')).status).toBe(200);
    });
  });

  describe('the Istanbul month and the subscription', () => {
    // A venue with a subscription over the whole of 2026 and a fixed "now".
    async function monthVenue(quota: number) {
      kit.clock.fixed = new Date('2026-10-15T09:00:00Z');
      const venue = await kit.makeVenue(
        'ownerA',
        `m-${Math.random().toString(36).slice(2, 6)}`,
      );
      await kit.subscribe(
        venue.venueId,
        quota,
        new Date('2026-01-01T00:00:00Z'),
        new Date('2027-01-01T00:00:00Z'),
      );
      const offer = (extra: Record<string, unknown> = {}) =>
        kit.makeOffer(venue.branchIds[0]!, {
          validFrom: new Date('2026-09-01T00:00:00Z'),
          validUntil: new Date('2026-12-01T00:00:00Z'),
          ...extra,
        });
      return { ...venue, offer };
    }
    const approvedAt = async (
      venue: Awaited<ReturnType<typeof monthVenue>>,
      instants: string[],
    ) => {
      for (const instant of instants) {
        const o = await venue.offer();
        await kit.insertCollaboration({
          offerId: o.id,
          influencerName: 'infY',
          ownerName: 'ownerA',
          status: 'APPROVED',
          approvedAt: new Date(instant),
        });
      }
    };

    it('counts from 00:00 Istanbul on the 1st (21:00:00 UTC) to the last millisecond of the month, and nothing outside', async () => {
      const venue = await monthVenue(3);
      await approvedAt(venue, [
        '2026-09-30T20:59:59.999Z', // 23:59:59.999 on 30 September: NOT October
        '2026-09-30T21:00:00.000Z', // 00:00 on 1 October: counted
        '2026-10-31T20:59:59.999Z', // 23:59:59.999 on 31 October: counted
        '2026-10-31T21:00:00.000Z', // 00:00 on 1 November: NOT October
      ]);
      const target = await venue.offer();
      const a = await applied('infX', target.id);

      // Two are counted (quota 3): the third approval fits ...
      expect((await decide('ownerA', a.id, 'approve')).status).toBe(200);
      // ... and now the month is full for the next one.
      const next = await venue.offer();
      const b = await applied('infX', next.id);
      const res = await decide('ownerA', b.id, 'approve');
      expect(res.status).toBe(409);
      expect(await code(res)).toBe('MONTHLY_QUOTA_EXCEEDED');
    });

    it('with a quota of 2 the two counted approvals use it up, the two outside the month do not help', async () => {
      const venue = await monthVenue(2);
      await approvedAt(venue, [
        '2026-09-30T21:00:00.000Z',
        '2026-10-31T20:59:59.999Z',
        '2026-09-30T20:59:59.999Z',
        '2026-10-31T21:00:00.000Z',
      ]);
      const target = await venue.offer();
      const a = await applied('infX', target.id);
      expect(await code(await decide('ownerA', a.id, 'approve'))).toBe(
        'MONTHLY_QUOTA_EXCEEDED',
      );
    });

    it('an approval at 00:00 Istanbul on the 1st (still 30 September in UTC) already counts for October', async () => {
      const venue = await monthVenue(1);
      await approvedAt(venue, ['2026-09-30T21:00:00.000Z']);
      const a = await applied('infX', (await venue.offer()).id);
      expect(await code(await decide('ownerA', a.id, 'approve'))).toBe(
        'MONTHLY_QUOTA_EXCEEDED',
      );
    });

    it('an approval at 00:00 Istanbul on 1 November (still 31 October in UTC) does not count for October', async () => {
      const venue = await monthVenue(1);
      await approvedAt(venue, ['2026-10-31T21:00:00.000Z']);
      const a = await applied('infX', (await venue.offer()).id);
      expect((await decide('ownerA', a.id, 'approve')).status).toBe(200);
    });

    it('the next month starts with a new count', async () => {
      const venue = await monthVenue(1);
      await approvedAt(venue, ['2026-10-20T09:00:00.000Z']);
      const target = await venue.offer({
        validUntil: new Date('2026-12-31T00:00:00Z'),
      });
      const a = await applied('infX', target.id);
      expect(await code(await decide('ownerA', a.id, 'approve'))).toBe(
        'MONTHLY_QUOTA_EXCEEDED',
      );
      kit.clock.fixed = new Date('2026-10-31T21:00:00.000Z'); // 1 November, Istanbul
      expect((await decide('ownerA', a.id, 'approve')).status).toBe(200);
    });

    it('a change of subscription inside the month keeps the same count; the limit is the current plan’s', async () => {
      kit.clock.fixed = new Date('2026-10-15T09:00:00Z');
      const venue = await kit.makeVenue(
        'ownerA',
        `s-${Math.random().toString(36).slice(2, 6)}`,
      );
      // Plan A (quota 10) until 10 October, plan B from then on.
      await kit.subscribe(
        venue.venueId,
        10,
        new Date('2026-01-01T00:00:00Z'),
        new Date('2026-10-10T00:00:00Z'),
      );
      const planB = await kit.subscribe(
        venue.venueId,
        3,
        new Date('2026-10-10T00:00:00Z'),
        new Date('2027-01-01T00:00:00Z'),
      );
      const open = (extra: Record<string, unknown> = {}) =>
        kit.makeOffer(venue.branchIds[0]!, {
          validFrom: new Date('2026-09-01T00:00:00Z'),
          validUntil: new Date('2026-12-01T00:00:00Z'),
          ...extra,
        });
      // Two approvals made under plan A, in the same Istanbul month.
      for (const instant of ['2026-10-03T09:00:00Z', '2026-10-05T09:00:00Z']) {
        await kit.insertCollaboration({
          offerId: (await open()).id,
          influencerName: 'infY',
          ownerName: 'ownerA',
          status: 'APPROVED',
          approvedAt: new Date(instant),
        });
      }
      const a = await applied('infX', (await open()).id);
      const b = await applied('infX', (await open()).id);

      // Plan B allows 3 per month and 2 are already counted: one more fits, then it is full.
      expect((await decide('ownerA', a.id, 'approve')).status).toBe(200);
      expect(await code(await decide('ownerA', b.id, 'approve'))).toBe(
        'MONTHLY_QUOTA_EXCEEDED',
      );
      // Lower the current plan's quota: the very same approvals count against it.
      await kit.prisma.subscriptionPlan.update({
        where: { id: planB.planId },
        data: { monthlyMatchQuota: 2 },
      });
      expect(await code(await decide('ownerA', b.id, 'approve'))).toBe(
        'MONTHLY_QUOTA_EXCEEDED',
      );
      await kit.prisma.subscriptionPlan.update({
        where: { id: planB.planId },
        data: { monthlyMatchQuota: 4 },
      });
      expect((await decide('ownerA', b.id, 'approve')).status).toBe(200);
    });

    it('a cancellation (a later task) cannot give a match back: approvedAt stays the basis of the count', async () => {
      const venue = await monthVenue(1);
      const first = await venue.offer();
      const done = await kit.insertCollaboration({
        offerId: first.id,
        influencerName: 'infY',
        ownerName: 'ownerA',
        status: 'APPROVED',
        approvedAt: new Date('2026-10-10T09:00:00Z'),
      });
      // The capacity looks at the status; the quota at approvedAt. Even if the
      // collaboration were no longer APPROVED, its approvedAt would still count.
      const counted = await kit.prisma.collaboration.count({
        where: {
          venueId: venue.venueId,
          approvedAt: {
            gte: new Date('2026-09-30T21:00:00Z'),
            lt: new Date('2026-10-31T21:00:00Z'),
          },
        },
      });
      expect(done.approvedAt).not.toBeNull();
      expect(counted).toBe(1);
    });
  });

  describe('reading, isolation and what leaks', () => {
    it('a venue owner reads only the applications to their own offers (404 otherwise)', async () => {
      const mine = await applied('infX');
      const foreign = await kit.makeVenue(
        'ownerB',
        `f-${Math.random().toString(36).slice(2, 6)}`,
      );
      await kit.subscribe(foreign.venueId, 10);
      const theirOffer = await kit.makeOffer(foreign.branchIds[0]!);
      const theirs = await applied('infY', theirOffer.id);

      const list = receivedCollaborationListSchema.parse(
        await (
          await request('GET', '/collaborations/received?pageSize=50', 'ownerA')
        ).json(),
      );
      expect(list.items.map((i) => i.id)).toContain(mine.id);
      expect(list.items.map((i) => i.id)).not.toContain(theirs.id);

      expect(
        (
          await request(
            'GET',
            `/collaborations/received/${theirs.id}`,
            'ownerA',
          )
        ).status,
      ).toBe(404);
      expect((await decide('ownerA', theirs.id, 'approve')).status).toBe(404);
      expect((await decide('ownerA', theirs.id, 'reject')).status).toBe(404);
      expect((await row(theirs.id)).status).toBe('APPLIED');
      expect(await kit.events(theirs.id)).toHaveLength(1);
    });

    it('an influencer reads only their own applications (404 for another’s)', async () => {
      const x = await applied('infX');
      const res = await request('GET', `/collaborations/mine/${x.id}`, 'infY');
      expect(res.status).toBe(404);
      const list = myCollaborationListSchema.parse(
        await (
          await request('GET', '/collaborations/mine?pageSize=50', 'infY')
        ).json(),
      );
      expect(list.items.map((i) => i.id)).not.toContain(x.id);
      expect(
        (await request('GET', `/collaborations/mine/${x.id}`, 'infX')).status,
      ).toBe(200);
    });

    it('roles are enforced on every endpoint', async () => {
      const x = await applied('infX');
      for (const [method, path, who] of [
        ['GET', '/collaborations/mine', 'ownerA'],
        ['GET', `/collaborations/mine/${x.id}`, 'ownerA'],
        ['GET', '/collaborations/received', 'infX'],
        ['GET', `/collaborations/received/${x.id}`, 'infX'],
        ['POST', `/collaborations/received/${x.id}/approve`, 'infX'],
        ['POST', `/collaborations/received/${x.id}/reject`, 'infX'],
        ['GET', '/collaborations/received', 'admin'],
        ['GET', '/collaborations/received', 'staff'],
        ['GET', '/collaborations/mine', 'staff'],
      ] as const) {
        expect(
          (await request(method, path, who)).status,
          `${method} ${path} as ${who}`,
        ).toBe(403);
      }
      expect(
        (await request('GET', '/collaborations/received', null)).status,
      ).toBe(401);
      expect((await row(x.id)).status).toBe('APPLIED');
    });

    it('the owner sees a basic applicant profile and nothing else about the user', async () => {
      const x = await applied('infX');
      const text = await (
        await request('GET', `/collaborations/received/${x.id}`, 'ownerA')
      ).text();
      const parsed = receivedCollaborationSchema.parse(JSON.parse(text));
      expect(parsed.applicant.name).toBe('Test infX');
      expect(parsed.applicant.profile).toMatchObject({
        city: 'İstanbul',
        bio: 'infX yemek içerikleri üretir',
      });
      expect(text).not.toMatch(
        /gossip-society\.example|passwordHash|argon2|"email"|"role"|"status":"ACTIVE"/,
      );
      expect(text).not.toContain(kit.userIds.get('infX'));
      expect(text).not.toContain(kit.userIds.get('ownerA'));
      expect(text).not.toMatch(/followerCount|"score"|"rating"|verified/i);
    });

    it('an applicant without a profile shows no profile (null), not an invented one', async () => {
      const y = await applied('infY');
      const parsed = receivedCollaborationSchema.parse(
        await (
          await request('GET', `/collaborations/received/${y.id}`, 'ownerA')
        ).json(),
      );
      expect(parsed.applicant.profile).toBeNull();
    });

    it('the influencer’s view has no owner e-mail, no user ids and no subscription', async () => {
      const x = await applied('infX');
      const text = await (
        await request('GET', `/collaborations/mine/${x.id}`, 'infX')
      ).text();
      expect(text).not.toMatch(
        /gossip-society\.example|passwordHash|argon2|plan|subscription|ownerId|venueId/i,
      );
      expect(text).not.toContain(venueId);
      expect(text).not.toContain(kit.userIds.get('ownerA'));
    });

    it('lists page without repeats or gaps, newest first, with status and offer filters', async () => {
      const offers = [
        offerId,
        (await kit.makeOffer(branchIds[1]!)).id,
        (await kit.makeOffer(branchIds[1]!)).id,
      ];
      // A user of its own: the shared influencers have applications from other tests.
      const lister = `lister-${Math.random().toString(36).slice(2, 6)}`;
      await kit.makeUser(lister, 'INFLUENCER');
      const mine = [];
      for (const id of offers) mine.push((await applied(lister, id)).id);
      await decide('ownerA', mine[0]!, 'reject');

      const seen: string[] = [];
      for (let page = 1; page <= 3; page++) {
        const list = myCollaborationListSchema.parse(
          await (
            await request(
              'GET',
              `/collaborations/mine?page=${page}&pageSize=1`,
              lister,
            )
          ).json(),
        );
        expect(list).toMatchObject({ total: 3, totalPages: 3 });
        seen.push(...list.items.map((i) => i.id));
      }
      expect(seen).toEqual([...mine].reverse());

      const rejected = myCollaborationListSchema.parse(
        await (
          await request('GET', '/collaborations/mine?status=REJECTED', lister)
        ).json(),
      );
      expect(rejected.items.map((i) => i.id)).toEqual([mine[0]]);

      const byOffer = receivedCollaborationListSchema.parse(
        await (
          await request(
            'GET',
            `/collaborations/received?offerId=${offers[1]}`,
            'ownerA',
          )
        ).json(),
      );
      expect(byOffer.items.map((i) => i.id)).toEqual([mine[1]]);
      for (const bad of [
        'pageSize=51',
        'page=0',
        'status=CANCELLED',
        'offerId=x',
      ]) {
        expect(
          (await request('GET', `/collaborations/received?${bad}`, 'ownerA'))
            .status,
        ).toBe(400);
      }
    });

    it('ignores an owner id, influencer id or status sent in the query', async () => {
      await applied('infX');
      // Users of their own (the shared ones have applications from other tests).
      const fresh = `fresh-${Math.random().toString(36).slice(2, 6)}`;
      const freshOwner = `fowner-${Math.random().toString(36).slice(2, 6)}`;
      await kit.makeUser(fresh, 'INFLUENCER');
      await kit.makeUser(freshOwner, 'VENUE_OWNER');
      const res = await request(
        'GET',
        `/collaborations/mine?influencerId=${kit.userIds.get('infX')}`,
        fresh,
      );
      expect(myCollaborationListSchema.parse(await res.json()).items).toEqual(
        [],
      );
      const other = await request(
        'GET',
        `/collaborations/received?ownerId=${kit.userIds.get('ownerA')}`,
        freshOwner,
      );
      expect(
        receivedCollaborationListSchema.parse(await other.json()).items,
      ).toEqual([]);
    });
  });

  describe('writing the row and its history together', () => {
    // A trigger that fails the INSERT of one kind of history entry, as if the
    // event table broke after the collaboration row was already written.
    async function failingEvents<T>(
      actor: string,
      toStatus: string,
      run: () => Promise<T>,
    ): Promise<T> {
      const fn = `itest_collab_fail_${kit.run}`;
      await kit.prisma.$executeRawUnsafe(`
        CREATE FUNCTION ${fn}() RETURNS trigger AS $$
        BEGIN
          IF NEW."actorId" = '${actor}'::uuid AND NEW."toStatus"::text = '${toStatus}' THEN
            RAISE EXCEPTION 'itest forced failure';
          END IF;
          RETURN NEW;
        END $$ LANGUAGE plpgsql`);
      await kit.prisma.$executeRawUnsafe(
        `CREATE TRIGGER ${fn} BEFORE INSERT ON "CollaborationEvent" FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
      );
      try {
        return await run();
      } finally {
        await kit.prisma.$executeRawUnsafe(
          `DROP TRIGGER IF EXISTS ${fn} ON "CollaborationEvent"`,
        );
        await kit.prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`);
      }
    }

    it('an event that cannot be written takes the whole APPLICATION back', async () => {
      const res = await failingEvents(kit.userIds.get('infX')!, 'APPLIED', () =>
        apply('infX', offerId),
      );
      expect(res.status).toBe(500);
      expect(await countRows({ offerId })).toBe(0);
      // Nothing is left behind: the influencer can apply normally afterwards.
      expect((await apply('infX', offerId)).status).toBe(201);
    });

    it('an event that cannot be written takes the APPROVAL back: still APPLIED, no approvedAt, no quota used', async () => {
      const tight = await kit.makeVenue(
        'ownerA',
        `t-${Math.random().toString(36).slice(2, 6)}`,
      );
      await kit.subscribe(tight.venueId, 1);
      const offer = await kit.makeOffer(tight.branchIds[0]!, { capacity: 1 });
      const a = await applied('infX', offer.id);

      const res = await failingEvents(
        kit.userIds.get('ownerA')!,
        'APPROVED',
        () => decide('ownerA', a.id, 'approve'),
      );

      expect(res.status).toBe(500);
      expect(await row(a.id)).toMatchObject({
        status: 'APPLIED',
        approvedAt: null,
        decidedAt: null,
        decidedById: null,
      });
      expect(await kit.events(a.id)).toHaveLength(1);
      expect(
        await countRows({ venueId: tight.venueId, approvedAt: { not: null } }),
      ).toBe(0);
      // The quota (1) and the capacity (1) were not used: the approval now works.
      expect((await decide('ownerA', a.id, 'approve')).status).toBe(200);
    });

    it('an event that cannot be written takes the REJECTION back', async () => {
      const a = await applied('infX');
      const res = await failingEvents(
        kit.userIds.get('ownerA')!,
        'REJECTED',
        () => decide('ownerA', a.id, 'reject'),
      );
      expect(res.status).toBe(500);
      expect(await row(a.id)).toMatchObject({
        status: 'APPLIED',
        decidedAt: null,
        decidedById: null,
      });
      expect(await kit.events(a.id)).toHaveLength(1);
      expect((await decide('ownerA', a.id, 'reject')).status).toBe(200);
    });
  });

  describe('the order of the history', () => {
    // The application and the decision carry the SAME time, and the ids are
    // chosen so that the (time, id) order of the query puts the decision FIRST.
    // (One pair per case: the ids are primary keys and the rows stay.)
    const ids = {
      approve: [
        'ffffffff-ffff-4fff-8fff-ffffffffffff',
        '00000000-0000-4000-8000-000000000001',
      ],
      reject: [
        'ffffffff-ffff-4fff-8fff-fffffffffffe',
        '00000000-0000-4000-8000-000000000002',
      ],
    } as const;

    it.each(['approve', 'reject'] as const)(
      'shows APPLIED before the decision when both have the same time (%s), to the influencer and to the owner',
      async (what) => {
        const who = what === 'approve' ? 'infX' : 'infY';
        const [APPLICATION_ID, DECISION_ID] = ids[what];
        const first = await applied(who);
        expect((await decide('ownerA', first.id, what)).status).toBe(200);
        const [creation, decision] = await kit.events(first.id);
        const sameTime = new Date('2026-10-10T12:00:00.000Z');
        await kit.prisma.collaborationEvent.update({
          where: { id: creation!.id },
          data: { id: APPLICATION_ID, createdAt: sameTime },
        });
        await kit.prisma.collaborationEvent.update({
          where: { id: decision!.id },
          data: { id: DECISION_ID, createdAt: sameTime },
        });
        // The precondition: the query's own order (time, then id) is the WRONG one here.
        expect((await kit.events(first.id)).map((e) => e.toStatus)).toEqual([
          what === 'approve' ? 'APPROVED' : 'REJECTED',
          'APPLIED',
        ]);

        const expected = [
          [null, 'APPLIED'],
          ['APPLIED', what === 'approve' ? 'APPROVED' : 'REJECTED'],
        ];
        const mine = myCollaborationSchema.parse(
          await (
            await request('GET', `/collaborations/mine/${first.id}`, who)
          ).json(),
        );
        const received = receivedCollaborationSchema.parse(
          await (
            await request(
              'GET',
              `/collaborations/received/${first.id}`,
              'ownerA',
            )
          ).json(),
        );
        for (const view of [mine, received]) {
          expect(view.history.map((h) => [h.fromStatus, h.toStatus])).toEqual(
            expected,
          );
        }
        // The decision's response (rebuilt from the same data) is in order too.
        const again = await decide('ownerA', first.id, what);
        expect(
          receivedCollaborationSchema
            .parse(await again.json())
            .history.map((h) => h.toStatus),
        ).toEqual(['APPLIED', what === 'approve' ? 'APPROVED' : 'REJECTED']);
      },
    );
  });

  describe('the database refuses what the rules forbid', () => {
    const base = () => ({
      offerId,
      influencerId: kit.userIds.get('infX')!,
      venueId,
      appliedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsSnapshot: { a: 1 },
    });

    it('a second row for the same (offer, influencer) is refused (the unique index)', async () => {
      await kit.prisma.collaboration.create({ data: base() });
      await expect(
        kit.prisma.collaboration.create({ data: base() }),
      ).rejects.toThrow();
    });

    it.each([
      ['APPLIED with a decision time', { decidedAt: new Date() }],
      [
        'APPROVED without approvedAt',
        {
          status: 'APPROVED' as const,
          decidedAt: new Date(),
          decidedById: 'owner',
        },
      ],
      [
        'REJECTED with approvedAt',
        {
          status: 'REJECTED' as const,
          decidedAt: new Date(),
          decidedById: 'owner',
          approvedAt: new Date(),
        },
      ],
      [
        'APPROVED without a decider',
        {
          status: 'APPROVED' as const,
          decidedAt: new Date(),
          approvedAt: new Date(),
        },
      ],
    ])('refuses %s', async (_n, change) => {
      const data: Record<string, unknown> = { ...base(), ...change };
      if (data.decidedById === 'owner')
        data.decidedById = kit.userIds.get('ownerA');
      await expect(
        kit.prisma.collaboration.create({ data: data as never }),
      ).rejects.toThrow();
    });

    it('refuses a terms snapshot that is not an object', async () => {
      await expect(
        kit.prisma.collaboration.create({
          data: { ...base(), termsSnapshot: [1] },
        }),
      ).rejects.toThrow();
    });

    it('allows only the transitions of this task in the history', async () => {
      const created = await kit.prisma.collaboration.create({ data: base() });
      const actorId = kit.userIds.get('infX')!;
      const event = (
        fromStatus: 'APPLIED' | 'APPROVED' | 'REJECTED' | null,
        toStatus: 'APPLIED' | 'APPROVED' | 'REJECTED',
      ) =>
        kit.prisma.collaborationEvent.create({
          data: { collaborationId: created.id, fromStatus, toStatus, actorId },
        });
      for (const [from, to] of [
        [null, 'APPROVED'],
        [null, 'REJECTED'],
        ['APPLIED', 'APPLIED'],
        ['APPROVED', 'REJECTED'],
        ['REJECTED', 'APPROVED'],
        ['APPROVED', 'APPLIED'],
      ] as const) {
        await expect(event(from, to), `${from} -> ${to}`).rejects.toThrow();
      }
      await event(null, 'APPLIED');
      await event('APPLIED', 'APPROVED');
    });

    it('deleting the collaboration removes its history; an offer with applications cannot be deleted', async () => {
      const created = await kit.prisma.collaboration.create({ data: base() });
      await kit.prisma.collaborationEvent.create({
        data: {
          collaborationId: created.id,
          fromStatus: null,
          toStatus: 'APPLIED',
          actorId: kit.userIds.get('infX')!,
        },
      });
      await expect(
        kit.prisma.offer.delete({ where: { id: offerId } }),
      ).rejects.toThrow();
      await kit.prisma.collaboration.delete({ where: { id: created.id } });
      expect(await kit.events(created.id)).toHaveLength(0);
    });
  });
});
