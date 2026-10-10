import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  istanbulMonthRange,
  myCollaborationListSchema,
  myCollaborationSchema,
  receivedCollaborationListSchema,
  receivedCollaborationSchema,
  type CollaborationTerms,
  type ListMyCollaborationsQuery,
  type ListReceivedCollaborationsQuery,
  type MyCollaboration,
  type MyCollaborationList,
  type ReceivedCollaboration,
  type ReceivedCollaborationList,
} from '@gossip/shared';
import {
  lockCollaboration,
  lockOfferShared,
  lockUserShared,
  lockVenue,
} from '../common/row-locks.js';
import { offerNotFound } from '../offers/offer-errors.js';
import { visibleAt } from '../offers/offer-visibility.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { collaborationConflict } from './collaboration-errors.js';

/** The clock of the collaboration rules. Tests replace it; it is read AFTER the locks. */
export const CLOCK = Symbol('CLOCK');
export type Clock = () => Date;

const newestFirst = [{ appliedAt: 'desc' as const }, { id: 'desc' as const }];

// What each side may read. Never an e-mail, a password hash, a user id of the
// other side or anything of the subscription.
// A mutable array: Prisma's orderBy type does not accept a readonly tuple.
const eventOrder: ({ createdAt: 'asc' } | { id: 'asc' })[] = [
  { createdAt: 'asc' },
  { id: 'asc' },
];
const historyInclude = {
  events: {
    select: { fromStatus: true, toStatus: true, createdAt: true },
    orderBy: eventOrder,
  },
} as const;

const myInclude = {
  ...historyInclude,
  offer: {
    select: {
      id: true,
      title: true,
      branch: {
        select: {
          name: true,
          city: true,
          venue: { select: { name: true } },
        },
      },
    },
  },
} as const;

const receivedInclude = {
  ...historyInclude,
  offer: {
    select: {
      id: true,
      title: true,
      branch: { select: { name: true, city: true } },
    },
  },
  influencer: {
    select: {
      name: true,
      influencerProfile: {
        select: { city: true, bio: true, instagramUsername: true },
      },
    },
  },
} as const;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: unknown }).code === 'P2002';

function toMine(row: {
  termsSnapshot: unknown;
  events: unknown;
  offer: { branch: { venue: unknown } & Record<string, unknown> };
}): MyCollaboration {
  const { branch } = row.offer;
  return myCollaborationSchema.parse({
    ...row,
    terms: row.termsSnapshot,
    offer: { ...row.offer, venue: branch.venue, branch },
    history: row.events,
  });
}

function toReceived(row: {
  termsSnapshot: unknown;
  events: unknown;
  influencer: { name: string; influencerProfile: unknown };
}): ReceivedCollaboration {
  return receivedCollaborationSchema.parse({
    ...row,
    terms: row.termsSnapshot,
    applicant: {
      name: row.influencer.name,
      profile: row.influencer.influencerProfile ?? null,
    },
    history: row.events,
  });
}

/**
 * The ONLY place a collaboration's state changes. Each operation writes the row
 * and its CollaborationEvent in one transaction (both or neither), takes its
 * row locks in the order documented in common/row-locks.ts, and reads the
 * clock and every fact it decides on AFTER the locks.
 *
 * States implemented here: APPLIED -> APPROVED | REJECTED, and the creation as
 * APPLIED. Nothing else changes a status.
 *
 * Quota policy. Capacity counts the collaborations that are APPROVED now. The
 * monthly match quota counts the collaborations the venue APPROVED in the
 * Europe/Istanbul calendar month, by `approvedAt` (written once, never cleared,
 * whatever the subscription at the time): a later cancellation therefore does
 * not give a match back by itself.
 */
@Injectable()
export class CollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // --- influencer ----------------------------------------------------------

  /**
   * An application to an open offer. The influencer is the authenticated user;
   * the terms are copied from the offer here, on the server. Only one
   * application per (offer, influencer) can ever exist: a second one (also
   * after a rejection) is a 409, and concurrent ones race on the unique index.
   */
  async apply(influencerId: string, offerId: string): Promise<MyCollaboration> {
    let id: string;
    try {
      id = await this.prisma.$transaction(async (tx) => {
        // The offer row is held (shared) from here to the commit: a suspension
        // waits for this transaction, or has already been committed and is seen
        // by the read below. The clock is read after the lock too.
        await lockOfferShared(tx, offerId);
        const now = this.clock();
        const offer = await tx.offer.findFirst({
          where: { id: offerId, ...visibleAt(now) },
          select: {
            title: true,
            serviceDescription: true,
            serviceValueKurus: true,
            expectedContent: true,
            minFollowers: true,
            validFrom: true,
            validUntil: true,
            branch: { select: { venueId: true } },
          },
        });
        if (!offer) throw offerNotFound();

        const earlier = await tx.collaboration.findFirst({
          where: { offerId, influencerId },
          select: { id: true },
        });
        if (earlier) throw collaborationConflict('ALREADY_APPLIED');

        const terms: CollaborationTerms = {
          title: offer.title,
          serviceDescription: offer.serviceDescription,
          serviceValueKurus: offer.serviceValueKurus,
          expectedContent: offer.expectedContent,
          minFollowers: offer.minFollowers,
          validFrom: offer.validFrom.toISOString(),
          validUntil: offer.validUntil.toISOString(),
        };
        const created = await tx.collaboration.create({
          data: {
            offerId,
            influencerId,
            venueId: offer.branch.venueId,
            appliedAt: now,
            termsAcceptedAt: now,
            termsSnapshot: terms,
          },
          select: { id: true },
        });
        await tx.collaborationEvent.create({
          data: {
            collaborationId: created.id,
            fromStatus: null,
            toStatus: 'APPLIED',
            actorId: influencerId,
            createdAt: now,
          },
        });
        return created.id;
      });
    } catch (error) {
      // A concurrent application of the same influencer to the same offer: the
      // unique index let exactly one of them in.
      if (isUniqueViolation(error))
        throw collaborationConflict('ALREADY_APPLIED');
      throw error;
    }
    return this.getMine(influencerId, id);
  }

  async listMine(
    influencerId: string,
    { page, pageSize, status }: ListMyCollaborationsQuery,
  ): Promise<MyCollaborationList> {
    const where = { influencerId, ...(status ? { status } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.collaboration.findMany({
        where,
        orderBy: newestFirst,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: myInclude,
      }),
      this.prisma.collaboration.count({ where }),
    ]);
    return myCollaborationListSchema.parse({
      items: rows.map((row) => {
        const { branch } = row.offer;
        return {
          ...row,
          offer: { ...row.offer, venue: branch.venue, branch },
        };
      }),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  }

  async getMine(influencerId: string, id: string): Promise<MyCollaboration> {
    const row = await this.prisma.collaboration.findFirst({
      where: { id, influencerId },
      include: myInclude,
    });
    if (!row) throw collaborationNotFound(); // someone else's looks like a missing one
    return toMine(row);
  }

  // --- venue owner ---------------------------------------------------------

  async listReceived(
    ownerId: string,
    { page, pageSize, status, offerId }: ListReceivedCollaborationsQuery,
  ): Promise<ReceivedCollaborationList> {
    const where = {
      venue: { ownerId },
      ...(status ? { status } : {}),
      ...(offerId ? { offerId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.collaboration.findMany({
        where,
        orderBy: newestFirst,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: receivedInclude,
      }),
      this.prisma.collaboration.count({ where }),
    ]);
    return receivedCollaborationListSchema.parse({
      items: rows.map((row) => ({
        ...row,
        applicant: { name: row.influencer.name },
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  }

  async getReceived(
    ownerId: string,
    id: string,
  ): Promise<ReceivedCollaboration> {
    const row = await this.prisma.collaboration.findFirst({
      where: { id, venue: { ownerId } },
      include: receivedInclude,
    });
    if (!row) throw collaborationNotFound();
    return toReceived(row);
  }

  /**
   * APPLIED -> APPROVED. Locks: venue, offer (shared), collaboration, applicant
   * (shared), in that order. Everything it decides on is read after the locks,
   * with one clock reading. A refusal rolls everything back: no event, no
   * approvedAt, so no quota is used.
   *
   * Approving an APPROVED collaboration again returns it unchanged (no second
   * event); approving a REJECTED one is a 409.
   */
  async approve(ownerId: string, id: string): Promise<ReceivedCollaboration> {
    await this.prisma.$transaction(async (tx) => {
      const found = await this.ownedIds(tx, ownerId, id);
      await lockVenue(tx, found.venueId);
      await lockOfferShared(tx, found.offerId);
      await lockCollaboration(tx, id);
      await lockUserShared(tx, found.influencerId);

      // From here on everything is read after the locks, with one clock reading.
      const now = this.clock();
      const current = await tx.collaboration.findFirst({
        where: { id, venue: { ownerId } },
        select: { status: true },
      });
      if (!current) throw collaborationNotFound();
      if (current.status === 'APPROVED') return; // the same decision again
      if (current.status === 'REJECTED') {
        throw collaborationConflict('COLLABORATION_ALREADY_REJECTED');
      }

      const offer = await tx.offer.findFirst({
        where: { id: found.offerId, ...visibleAt(now) },
        select: { capacity: true },
      });
      if (!offer) throw collaborationConflict('OFFER_NOT_OPEN');

      const subscription = await tx.subscription.findFirst({
        where: {
          venueId: found.venueId,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        select: { plan: { select: { monthlyMatchQuota: true } } },
      });
      if (!subscription) throw collaborationConflict('NO_ACTIVE_SUBSCRIPTION');

      const applicant = await tx.user.findFirst({
        where: { id: found.influencerId, role: 'INFLUENCER', status: 'ACTIVE' },
        select: { id: true },
      });
      if (!applicant) throw collaborationConflict('APPLICANT_NOT_ELIGIBLE');

      const approvedHere = await tx.collaboration.count({
        where: { offerId: found.offerId, status: 'APPROVED' },
      });
      if (approvedHere >= offer.capacity) {
        throw collaborationConflict('OFFER_CAPACITY_FULL');
      }

      // The monthly quota belongs to the venue: every offer and branch, and
      // every subscription of the Istanbul month, count together.
      const { start, end } = istanbulMonthRange(now);
      const approvedThisMonth = await tx.collaboration.count({
        where: {
          venueId: found.venueId,
          approvedAt: { gte: start, lt: end },
        },
      });
      if (approvedThisMonth >= subscription.plan.monthlyMatchQuota) {
        throw collaborationConflict('MONTHLY_QUOTA_EXCEEDED');
      }

      await tx.collaboration.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: now,
          decidedAt: now,
          decidedById: ownerId,
        },
      });
      await tx.collaborationEvent.create({
        data: {
          collaborationId: id,
          fromStatus: 'APPLIED',
          toStatus: 'APPROVED',
          actorId: ownerId,
          createdAt: now,
        },
      });
    });
    return this.getReceived(ownerId, id);
  }

  /**
   * APPLIED -> REJECTED. Takes only the collaboration lock (a subsequence of the
   * common order). It needs neither an open offer nor a valid subscription, so
   * an application to an offer that is no longer visible can still be rejected.
   * Rejecting a REJECTED collaboration again returns it unchanged; rejecting an
   * APPROVED one is a 409.
   */
  async reject(ownerId: string, id: string): Promise<ReceivedCollaboration> {
    await this.prisma.$transaction(async (tx) => {
      await this.ownedIds(tx, ownerId, id);
      await lockCollaboration(tx, id);

      const now = this.clock();
      const current = await tx.collaboration.findFirst({
        where: { id, venue: { ownerId } },
        select: { status: true },
      });
      if (!current) throw collaborationNotFound();
      if (current.status === 'REJECTED') return; // the same decision again
      if (current.status === 'APPROVED') {
        throw collaborationConflict('COLLABORATION_ALREADY_APPROVED');
      }

      await tx.collaboration.update({
        where: { id },
        data: { status: 'REJECTED', decidedAt: now, decidedById: ownerId },
      });
      await tx.collaborationEvent.create({
        data: {
          collaborationId: id,
          fromStatus: 'APPLIED',
          toStatus: 'REJECTED',
          actorId: ownerId,
          createdAt: now,
        },
      });
    });
    return this.getReceived(ownerId, id);
  }

  // The venue, offer and applicant of a collaboration of the caller's venue
  // (404 otherwise). Read BEFORE the locks only to know which rows to lock;
  // none of these ever changes for a collaboration.
  private async ownedIds(
    tx: Pick<PrismaService, 'collaboration'>,
    ownerId: string,
    id: string,
  ) {
    const found = await tx.collaboration.findFirst({
      where: { id, venue: { ownerId } },
      select: { venueId: true, offerId: true, influencerId: true },
    });
    if (!found) throw collaborationNotFound();
    return found;
  }
}

const collaborationNotFound = () =>
  new NotFoundException('Başvuru bulunamadı.');
