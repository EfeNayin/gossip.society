import { collaborationErrorSchema } from '@gossip/shared';
import {
  createKit,
  DAY,
  at,
  waitBlocked,
  type Kit,
} from './collaboration-test-kit.js';

// The races of collaborations against the real PostgreSQL, with a CONTROLLED
// order. The test itself holds a lock (or an uncommitted change), starts the
// requests, waits until PostgreSQL (pg_stat_activity) reports each one blocked
// on the lock it is meant to wait for, and only then lets them run. So which
// statement runs before which does not depend on timing. The lock order they
// exercise is documented in common/row-locks.ts.
//
// Pattern of the statements the service waits on (Prisma sends them as given):
const VENUE = '%FROM "Venue"%FOR UPDATE%';
const OFFER_SHARE = '%FROM "Offer"%FOR SHARE%';
const COLLAB_LOCK = '%FROM "Collaboration"%FOR UPDATE%';
const USER_SHARE = '%FROM "User"%FOR SHARE%';
const OFFER_UPDATE = '%UPDATE%"Offer"%';
const COLLAB_INSERT = '%INSERT INTO%"Collaboration"%';

describe('collaborations: locks and ordering (PostgreSQL, controlled order)', () => {
  let kit: Kit;
  const tag = () => Math.random().toString(36).slice(2, 7);
  const send = (...a: Parameters<Kit['request']>) => kit.request(...a);

  const apply = (who: string, offerId: string) =>
    send('POST', '/collaborations/mine', who, { offerId, acceptTerms: true });
  const decide = (who: string, id: string, what: 'approve' | 'reject') =>
    send('POST', `/collaborations/received/${id}/${what}`, who);
  const code = async (res: Response) =>
    collaborationErrorSchema.parse(await res.json()).code;
  const applied = async (who: string, offerId: string) => {
    const res = await apply(who, offerId);
    expect(res.status).toBe(201);
    return ((await res.json()) as { id: string }).id;
  };
  const row = (id: string) =>
    kit.prisma.collaboration.findUniqueOrThrow({ where: { id } });
  const approvedCount = (where: Record<string, unknown>) =>
    kit.prisma.collaboration.count({ where: { ...where, status: 'APPROVED' } });
  const admin = () =>
    kit.prisma.user.findFirstOrThrow({ where: { email: kit.email('admin') } });
  const suspendViaApi = (offerId: string) =>
    send('POST', `/admin/offers/${offerId}/suspend`, 'admin', {
      reason: 'test',
    });

  // A transaction the TEST holds open. `work` runs inside it first (statements
  // that take locks or change data, uncommitted); then it waits for the verdict.
  function hold(work: (tx: Kit['prisma']) => Promise<void>) {
    let decide!: (commit: boolean) => void;
    const verdict = new Promise<boolean>((resolve) => (decide = resolve));
    let ready!: () => void;
    const readyPromise = new Promise<void>((resolve) => (ready = resolve));
    const done = kit.prisma.$transaction(
      async (tx) => {
        await work(tx as unknown as Kit['prisma']);
        ready();
        if (!(await verdict)) throw new Error('rolled back on purpose');
      },
      { timeout: 25_000, maxWait: 10_000 },
    );
    const settled = done.catch(() => undefined);
    return {
      ready: readyPromise,
      commit: async () => {
        decide(true);
        await done;
      },
      rollback: async () => {
        decide(false);
        await settled;
      },
    };
  }
  const lockVenue = (id: string) =>
    hold(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT id FROM "Venue" WHERE id = '${id}'::uuid FOR UPDATE`,
      );
    });

  // A venue with a subscription (monthly quota given) and one open offer.
  async function venue(
    options: { quota?: number; capacity?: number; branches?: number } = {},
  ) {
    const made = await kit.makeVenue(
      'ownerA',
      `v-${tag()}`,
      options.branches ?? 2,
    );
    await kit.subscribe(made.venueId, options.quota ?? 50);
    const offer = await kit.makeOffer(made.branchIds[0]!, {
      capacity: options.capacity ?? 5,
    });
    return { ...made, offer };
  }

  beforeAll(async () => {
    kit = await createKit('collock');
    await kit.makeUser('ownerA', 'VENUE_OWNER');
    await kit.makeUser('ownerB', 'VENUE_OWNER');
    await kit.makeUser('admin', 'ADMIN');
    for (const name of ['i1', 'i2', 'i3', 'i4', 'i5', 'i6']) {
      await kit.makeUser(name, 'INFLUENCER');
    }
  });
  afterAll(() => kit.close());
  beforeEach(() => {
    kit.clock.fixed = null;
  });

  describe('approvals share one venue lock', () => {
    it('two approvals for the last place of an offer: exactly one wins, the other is OFFER_CAPACITY_FULL', async () => {
      const v = await venue({ capacity: 1 });
      const a = await applied('i1', v.offer.id);
      const b = await applied('i2', v.offer.id);
      const held = lockVenue(v.venueId);
      await held.ready;

      const first = decide('ownerA', a, 'approve');
      const second = decide('ownerA', b, 'approve');
      await waitBlocked(kit.prisma, VENUE, 2); // both are waiting at the venue lock
      expect(await approvedCount({ offerId: v.offer.id })).toBe(0);
      await held.commit();
      const results = [await first, await second];

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const loser = results.find((r) => r.status === 409)!;
      expect(await code(loser)).toBe('OFFER_CAPACITY_FULL');
      expect(await approvedCount({ offerId: v.offer.id })).toBe(1);
      const rows = await kit.prisma.collaboration.findMany({
        where: { offerId: v.offer.id },
      });
      for (const r of rows) {
        const events = await kit.events(r.id);
        expect(events).toHaveLength(r.status === 'APPROVED' ? 2 : 1);
      }
    });

    it('two approvals for the last match of the month on DIFFERENT offers and branches: exactly one wins', async () => {
      const v = await venue({ quota: 1 });
      const second = await kit.makeOffer(v.branchIds[1]!);
      const a = await applied('i1', v.offer.id);
      const b = await applied('i2', second.id);
      const held = lockVenue(v.venueId);
      await held.ready;

      const first = decide('ownerA', a, 'approve');
      const other = decide('ownerA', b, 'approve');
      await waitBlocked(kit.prisma, VENUE, 2);
      await held.commit();
      const results = [await first, await other];

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await code(results.find((r) => r.status === 409)!)).toBe(
        'MONTHLY_QUOTA_EXCEEDED',
      );
      expect(await approvedCount({ venueId: v.venueId })).toBe(1);
    });

    it('a quota shared with other offers is also used up by a third approval racing the last one', async () => {
      const v = await venue({ quota: 2 });
      const offers = [
        v.offer,
        await kit.makeOffer(v.branchIds[1]!),
        await kit.makeOffer(v.branchIds[0]!),
      ];
      const ids = [
        await applied('i1', offers[0]!.id),
        await applied('i2', offers[1]!.id),
        await applied('i3', offers[2]!.id),
      ];
      const held = lockVenue(v.venueId);
      await held.ready;
      const runs = ids.map((id) => decide('ownerA', id, 'approve'));
      await waitBlocked(kit.prisma, VENUE, 3);
      await held.commit();
      const results = await Promise.all(runs);
      expect(results.map((r) => r.status).sort()).toEqual([200, 200, 409]);
      expect(await approvedCount({ venueId: v.venueId })).toBe(2);
    });

    it('approve, publish and a draft edit of one venue queue on the same lock and all complete (no deadlock)', async () => {
      const v = await venue();
      const a = await applied('i1', v.offer.id);
      const draft = await kit.makeOffer(v.branchIds[0]!, {
        status: 'DRAFT',
        publishedAt: null,
      });
      const held = lockVenue(v.venueId);
      await held.ready;

      const approve = decide('ownerA', a, 'approve');
      const publish = send(
        'POST',
        `/offers/mine/${draft.id}/publish`,
        'ownerA',
      );
      const edit = send('PUT', `/offers/mine/${draft.id}`, 'ownerA', {
        title: 'Düzenlendi',
        description: 'd',
        serviceDescription: 's',
        serviceValueKurus: 100,
        expectedContent: 'e',
        minFollowers: 0,
        capacity: 1,
        validFrom: at(-DAY).toISOString(),
        validUntil: at(30 * DAY).toISOString(),
      });
      await waitBlocked(kit.prisma, VENUE, 3);
      await held.commit();
      const [r1, r2, r3] = await Promise.all([approve, publish, edit]);

      expect(r1.status).toBe(200);
      // The draft is edited or published first, whichever the lock grants first,
      // and the second of the two sees the result of the first.
      expect([r2.status, r3.status].sort()).toEqual(
        r2.status === 200 && r3.status === 409 ? [200, 409] : [200, 200],
      );
      expect(await approvedCount({ venueId: v.venueId })).toBe(1);
    });

    it('another venue does not wait: an approval there completes while this venue’s lock is held', async () => {
      const mine = await venue();
      const theirs = await venue();
      const a = await applied('i1', theirs.offer.id);
      const held = lockVenue(mine.venueId);
      await held.ready;
      const res = await decide('ownerA', a, 'approve'); // would hang if venues shared a lock
      await held.commit();
      expect(res.status).toBe(200);
    });

    it('a rejection needs no venue lock: it completes while the venue is locked', async () => {
      const v = await venue();
      const a = await applied('i1', v.offer.id);
      const held = lockVenue(v.venueId);
      await held.ready;
      const res = await decide('ownerA', a, 'reject');
      await held.commit();
      expect(res.status).toBe(200);
    });

    it('the same approval sent twice at once: one event, one approvedAt, both answers 200', async () => {
      const v = await venue();
      const a = await applied('i1', v.offer.id);
      const held = lockVenue(v.venueId);
      await held.ready;
      const runs = [
        decide('ownerA', a, 'approve'),
        decide('ownerA', a, 'approve'),
      ];
      await waitBlocked(kit.prisma, VENUE, 2);
      await held.commit();
      const results = await Promise.all(runs);
      expect(results.map((r) => r.status)).toEqual([200, 200]);
      expect(await kit.events(a)).toHaveLength(2);
      expect(await approvedCount({ venueId: v.venueId })).toBe(1);
    });
  });

  describe('approve and reject on one collaboration', () => {
    it('a rejection committed while the approval waits for the collaboration lock: the approval is 409 and uses no quota', async () => {
      const v = await venue({ quota: 1 });
      const a = await applied('i1', v.offer.id);
      const owner = kit.userIds.get('ownerA')!;
      const held = hold(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT id FROM "Collaboration" WHERE id = '${a}'::uuid FOR UPDATE`,
        );
        // The reject, done by hand and not yet committed.
        await tx.$executeRawUnsafe(
          `UPDATE "Collaboration" SET status = 'REJECTED', "decidedAt" = now(), "decidedById" = '${owner}'::uuid WHERE id = '${a}'::uuid`,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "CollaborationEvent"(id, "collaborationId", "fromStatus", "toStatus", "actorId") VALUES (gen_random_uuid(), '${a}'::uuid, 'APPLIED', 'REJECTED', '${owner}'::uuid)`,
        );
      });
      await held.ready;

      const approve = decide('ownerA', a, 'approve');
      await waitBlocked(kit.prisma, COLLAB_LOCK); // past the venue and offer locks
      await held.commit();
      const res = await approve;

      expect(res.status).toBe(409);
      expect(await code(res)).toBe('COLLABORATION_ALREADY_REJECTED');
      expect(await row(a)).toMatchObject({
        status: 'REJECTED',
        approvedAt: null,
      });
      expect(await kit.events(a)).toHaveLength(2);
      // The quota (1) is untouched: another application can still be approved.
      const b = await applied('i2', v.offer.id);
      expect((await decide('ownerA', b, 'approve')).status).toBe(200);
    });

    it('an approval committed while the rejection waits: the rejection is 409 and the approval stands', async () => {
      const v = await venue();
      const a = await applied('i1', v.offer.id);
      const owner = kit.userIds.get('ownerA')!;
      const held = hold(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT id FROM "Collaboration" WHERE id = '${a}'::uuid FOR UPDATE`,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "Collaboration" SET status = 'APPROVED', "decidedAt" = now(), "approvedAt" = now(), "decidedById" = '${owner}'::uuid WHERE id = '${a}'::uuid`,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "CollaborationEvent"(id, "collaborationId", "fromStatus", "toStatus", "actorId") VALUES (gen_random_uuid(), '${a}'::uuid, 'APPLIED', 'APPROVED', '${owner}'::uuid)`,
        );
      });
      await held.ready;

      const reject = decide('ownerA', a, 'reject');
      await waitBlocked(kit.prisma, COLLAB_LOCK);
      await held.commit();
      const res = await reject;

      expect(res.status).toBe(409);
      expect(await code(res)).toBe('COLLABORATION_ALREADY_APPROVED');
      expect((await row(a)).status).toBe('APPROVED');
      expect(await kit.events(a)).toHaveLength(2);
    });

    it('approve and reject sent at the same moment: exactly one decision exists, the other is 409, the history agrees', async () => {
      for (let round = 0; round < 6; round++) {
        const v = await venue({ quota: 1, capacity: 1 });
        const a = await applied('i1', v.offer.id);
        const [approve, reject] = await Promise.all([
          decide('ownerA', a, 'approve'),
          decide('ownerA', a, 'reject'),
        ]);

        expect([approve.status, reject.status].sort()).toEqual([200, 409]);
        const stored = await row(a);
        expect(['APPROVED', 'REJECTED']).toContain(stored.status);
        expect(approve.status).toBe(stored.status === 'APPROVED' ? 200 : 409);
        expect(await kit.events(a)).toHaveLength(2);
        expect(await approvedCount({ venueId: v.venueId })).toBe(
          stored.status === 'APPROVED' ? 1 : 0,
        );
      }
    });
  });

  describe('suspending an offer and approving / applying', () => {
    it('suspended BEFORE the approval looks: the approval is OFFER_NOT_OPEN', async () => {
      const v = await venue();
      const a = await applied('i1', v.offer.id);
      const held = lockVenue(v.venueId);
      await held.ready;

      const approve = decide('ownerA', a, 'approve');
      await waitBlocked(kit.prisma, VENUE);
      expect((await suspendViaApi(v.offer.id)).status).toBe(200); // not blocked: no venue lock
      await held.commit();
      const res = await approve;

      expect(res.status).toBe(409);
      expect(await code(res)).toBe('OFFER_NOT_OPEN');
      expect(await row(a)).toMatchObject({
        status: 'APPLIED',
        approvedAt: null,
      });
      expect(await kit.events(a)).toHaveLength(1);
    });

    it('suspended WHILE the approval is under way: the suspension waits for the approval and comes after it', async () => {
      const v = await venue();
      const a = await applied('i1', v.offer.id);
      const held = hold(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT id FROM "Collaboration" WHERE id = '${a}'::uuid FOR UPDATE`,
        );
      });
      await held.ready;

      const approve = decide('ownerA', a, 'approve');
      await waitBlocked(kit.prisma, COLLAB_LOCK); // the approval holds the offer (shared) already
      const suspend = suspendViaApi(v.offer.id);
      await waitBlocked(kit.prisma, OFFER_UPDATE); // the suspension is waiting for it
      await held.commit();
      const [approved, suspended] = [await approve, await suspend];

      expect(approved.status).toBe(200);
      expect(suspended.status).toBe(200);
      const offer = await kit.prisma.offer.findUniqueOrThrow({
        where: { id: v.offer.id },
      });
      const stored = await row(a);
      expect(offer.status).toBe('SUSPENDED');
      expect(stored.status).toBe('APPROVED');
      // The order is shown by the wait above: the suspension was blocked by the
      // approval's shared lock of the offer and ran after it. (Their timestamps
      // cannot show it: the suspension stamps its time when it is received.)
    });

    it('suspended BEFORE the application looks: the application is a 404 and nothing is stored', async () => {
      const v = await venue();
      const held = hold(async (tx) => {
        // The suspension, done by hand and not yet committed: the offer row is locked.
        await tx.$executeRawUnsafe(
          `UPDATE "Offer" SET status = 'SUSPENDED', "suspendedAt" = now(), "suspensionReason" = 'x', "suspendedById" = '${(await admin()).id}'::uuid WHERE id = '${v.offer.id}'::uuid`,
        );
      });
      await held.ready;

      const pending = apply('i1', v.offer.id);
      await waitBlocked(kit.prisma, OFFER_SHARE);
      await held.commit();
      const res = await pending;

      expect(res.status).toBe(404);
      expect(
        await kit.prisma.collaboration.count({
          where: { offerId: v.offer.id },
        }),
      ).toBe(0);
    });

    it('suspended WHILE the application is being written: the suspension waits, the application stands', async () => {
      const v = await venue();
      const influencer = kit.userIds.get('i1')!;
      // An uncommitted application of the same influencer: the new one will stop at the unique index
      // after it has taken the shared lock of the offer.
      const held = hold(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Collaboration"(id, "offerId", "influencerId", "venueId", status, "appliedAt", "termsAcceptedAt", "termsSnapshot", "updatedAt") VALUES (gen_random_uuid(), '${v.offer.id}'::uuid, '${influencer}'::uuid, '${v.venueId}'::uuid, 'APPLIED', now(), now(), '{}'::jsonb, now())`,
        );
      });
      await held.ready;

      const pending = apply('i1', v.offer.id);
      await waitBlocked(kit.prisma, COLLAB_INSERT);
      const suspend = suspendViaApi(v.offer.id);
      await waitBlocked(kit.prisma, OFFER_UPDATE); // waits for the share lock the application holds
      await held.rollback(); // the unique index no longer blocks the application
      const [applyRes, suspendRes] = [await pending, await suspend];

      expect(applyRes.status).toBe(201);
      expect(suspendRes.status).toBe(200);
      const stored = await kit.prisma.collaboration.findFirstOrThrow({
        where: { offerId: v.offer.id },
      });
      const offer = await kit.prisma.offer.findUniqueOrThrow({
        where: { id: v.offer.id },
      });
      expect(stored.appliedAt.getTime()).toBeLessThanOrEqual(
        offer.suspendedAt!.getTime(),
      );
    });
  });

  describe('concurrent applications', () => {
    it('an application that meets an uncommitted one of the same influencer waits and is then a 409 ALREADY_APPLIED', async () => {
      const v = await venue();
      const influencer = kit.userIds.get('i1')!;
      const held = hold(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Collaboration"(id, "offerId", "influencerId", "venueId", status, "appliedAt", "termsAcceptedAt", "termsSnapshot", "updatedAt") VALUES (gen_random_uuid(), '${v.offer.id}'::uuid, '${influencer}'::uuid, '${v.venueId}'::uuid, 'APPLIED', now(), now(), '{}'::jsonb, now())`,
        );
      });
      await held.ready;

      const pending = apply('i1', v.offer.id);
      await waitBlocked(kit.prisma, COLLAB_INSERT);
      await held.commit();
      const res = await pending;

      expect(res.status).toBe(409);
      expect(await code(res)).toBe('ALREADY_APPLIED');
      expect(
        await kit.prisma.collaboration.count({
          where: { offerId: v.offer.id },
        }),
      ).toBe(1);
    });

    it('when the first one rolls back instead, the waiting application is created', async () => {
      const v = await venue();
      const influencer = kit.userIds.get('i1')!;
      const held = hold(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Collaboration"(id, "offerId", "influencerId", "venueId", status, "appliedAt", "termsAcceptedAt", "termsSnapshot", "updatedAt") VALUES (gen_random_uuid(), '${v.offer.id}'::uuid, '${influencer}'::uuid, '${v.venueId}'::uuid, 'APPLIED', now(), now(), '{}'::jsonb, now())`,
        );
      });
      await held.ready;
      const pending = apply('i1', v.offer.id);
      await waitBlocked(kit.prisma, COLLAB_INSERT);
      await held.rollback();
      expect((await pending).status).toBe(201);
      expect(
        await kit.prisma.collaboration.count({
          where: { offerId: v.offer.id },
        }),
      ).toBe(1);
    });

    it('eight applications of one influencer at once leave one row and one history entry', async () => {
      const v = await venue();
      const results = await Promise.all(
        Array.from({ length: 8 }, () => apply('i2', v.offer.id)),
      );
      expect(
        results.map((r) => r.status).filter((s) => s === 201),
      ).toHaveLength(1);
      expect(
        results.map((r) => r.status).filter((s) => s === 409),
      ).toHaveLength(7);
      const rows = await kit.prisma.collaboration.findMany({
        where: { offerId: v.offer.id },
      });
      expect(rows).toHaveLength(1);
      expect(await kit.events(rows[0]!.id)).toHaveLength(1);
    });

    it('many influencers applying to one offer at once do not block each other (shared offer lock)', async () => {
      const v = await venue();
      const names = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'];
      const results = await Promise.all(names.map((n) => apply(n, v.offer.id)));
      expect(results.map((r) => r.status)).toEqual(Array(6).fill(201));
    });
  });

  it('an applicant suspended while the approval is under way cannot be approved', async () => {
    const v = await venue();
    const a = await applied('i1', v.offer.id);
    const influencer = kit.userIds.get('i1')!;
    const held = hold(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT id FROM "User" WHERE id = '${influencer}'::uuid FOR UPDATE`,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "User" SET status = 'SUSPENDED' WHERE id = '${influencer}'::uuid`,
      );
    });
    await held.ready;
    try {
      const approve = decide('ownerA', a, 'approve');
      await waitBlocked(kit.prisma, USER_SHARE); // after the venue, offer and collaboration locks
      await held.commit();
      const res = await approve;
      expect(res.status).toBe(409);
      expect(await code(res)).toBe('APPLICANT_NOT_ELIGIBLE');
      expect(await row(a)).toMatchObject({
        status: 'APPLIED',
        approvedAt: null,
      });
      expect(await kit.events(a)).toHaveLength(1);
    } finally {
      await kit.prisma.user.update({
        where: { id: influencer },
        data: { status: 'ACTIVE' },
      });
    }
  });

  it('a mixed storm of applications, decisions, suspensions and publishes ends without a deadlock and with consistent data', async () => {
    const quota = 4;
    const v = await venue({ quota, capacity: 3 });
    const offers = [
      v.offer,
      await kit.makeOffer(v.branchIds[1]!, { capacity: 2 }),
      await kit.makeOffer(v.branchIds[0]!, { capacity: 2 }),
    ];
    const draft = await kit.makeOffer(v.branchIds[0]!, {
      status: 'DRAFT',
      publishedAt: null,
    });
    const people = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'];
    const created: string[] = [];
    for (const offer of offers) {
      for (const person of people.slice(0, 4))
        created.push(await applied(person, offer.id));
    }

    const operations: Promise<Response>[] = [];
    for (const id of created) {
      operations.push(decide('ownerA', id, 'approve'));
      if (Math.random() < 0.4) operations.push(decide('ownerA', id, 'reject'));
    }
    for (const offer of offers)
      for (const person of people.slice(4))
        operations.push(apply(person, offer.id));
    operations.push(suspendViaApi(offers[2]!.id));
    operations.push(send('POST', `/offers/mine/${draft.id}/publish`, 'ownerA'));
    const results = await Promise.all(operations);

    // A deadlock would surface as a 500: there must be none.
    expect(results.filter((r) => r.status >= 500)).toEqual([]);
    // Invariants of the data.
    for (const offer of offers) {
      const approved = await approvedCount({ offerId: offer.id });
      const capacity = (
        await kit.prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })
      ).capacity;
      expect(approved).toBeLessThanOrEqual(capacity);
    }
    expect(await approvedCount({ venueId: v.venueId })).toBeLessThanOrEqual(
      quota,
    );
    const all = await kit.prisma.collaboration.findMany({
      where: { venueId: v.venueId },
    });
    for (const c of all) {
      expect(await kit.events(c.id)).toHaveLength(
        c.status === 'APPLIED' ? 1 : 2,
      );
    }
  });
});
