import { Injectable } from '@nestjs/common';
import {
  adminOfferListSchema,
  adminOfferSchema,
  ownerOfferListSchema,
  ownerOfferSchema,
  type AdminOffer,
  type AdminOfferList,
  type CreateOfferRequest,
  type ListOffersQuery,
  type OwnerOffer,
  type OwnerOfferList,
  type UpdateOfferRequest,
} from '@gossip/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  branchNotFound,
  offerConflict,
  offerNotFound,
} from './offer-errors.js';

// What an owner may read: the branch and its venue. Never the owner's or the
// admin's account data.
const ownerInclude = {
  branch: {
    select: {
      id: true,
      name: true,
      city: true,
      venue: { select: { id: true, name: true } },
    },
  },
} as const;

const adminInclude = {
  branch: {
    select: {
      id: true,
      name: true,
      city: true,
      venue: {
        select: {
          id: true,
          name: true,
          owner: { select: { id: true, name: true, email: true } },
        },
      },
    },
  },
  suspendedBy: { select: { id: true, name: true } },
} as const;

const newestFirst = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

function toOwnerOffer(row: {
  branch: { venue: unknown } & Record<string, unknown>;
  suspendedAt: Date | null;
  suspensionReason: string | null;
}): OwnerOffer {
  const { branch } = row;
  return ownerOfferSchema.parse({
    ...row,
    branch,
    venue: branch.venue,
    suspension:
      row.suspendedAt && row.suspensionReason
        ? { reason: row.suspensionReason, suspendedAt: row.suspendedAt }
        : null,
  });
}

function toAdminOffer(row: {
  branch: { venue: unknown } & Record<string, unknown>;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  suspendedBy: unknown;
}): AdminOffer {
  const { branch } = row;
  return adminOfferSchema.parse({
    ...row,
    branch,
    venue: branch.venue,
    suspension:
      row.suspendedAt && row.suspensionReason && row.suspendedBy
        ? {
            reason: row.suspensionReason,
            suspendedAt: row.suspendedAt,
            suspendedBy: row.suspendedBy,
          }
        : null,
  });
}

const dates = ({
  validFrom,
  validUntil,
}: {
  validFrom: string;
  validUntil: string;
}) => ({ validFrom: new Date(validFrom), validUntil: new Date(validUntil) });

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  // --- venue owner ---------------------------------------------------------

  /** A new DRAFT in one of the caller's own branches. */
  async createDraft(
    ownerId: string,
    { branchId, ...fields }: CreateOfferRequest,
  ): Promise<OwnerOffer> {
    const branch = await this.prisma.venueBranch.findFirst({
      where: { id: branchId, venue: { ownerId } },
      select: { id: true },
    });
    if (!branch) throw branchNotFound();

    // The status is not part of the data: the column default (DRAFT) applies.
    const row = await this.prisma.offer.create({
      data: { ...fields, ...dates(fields), branchId },
      include: ownerInclude,
    });
    return toOwnerOffer(row);
  }

  async listMine(
    ownerId: string,
    { page, pageSize, status }: ListOffersQuery,
  ): Promise<OwnerOfferList> {
    const where = {
      branch: { venue: { ownerId } },
      ...(status ? { status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        orderBy: newestFirst,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: ownerInclude,
      }),
      this.prisma.offer.count({ where }),
    ]);
    return ownerOfferListSchema.parse({
      items: rows.map(toOwnerOffer),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  }

  async getMine(ownerId: string, id: string): Promise<OwnerOffer> {
    const row = await this.prisma.offer.findFirst({
      where: { id, branch: { venue: { ownerId } } },
      include: ownerInclude,
    });
    if (!row) throw offerNotFound();
    return toOwnerOffer(row);
  }

  /** Edits a DRAFT. The status check is part of the UPDATE, so it can't race a publish. */
  async updateDraft(
    ownerId: string,
    id: string,
    fields: UpdateOfferRequest,
  ): Promise<OwnerOffer> {
    const { count } = await this.prisma.offer.updateMany({
      where: { id, status: 'DRAFT', branch: { venue: { ownerId } } },
      data: { ...fields, ...dates(fields) },
    });
    if (count === 0) {
      // Not found / not yours, or no longer a draft.
      await this.getMine(ownerId, id);
      throw offerConflict('OFFER_NOT_DRAFT');
    }
    return this.getMine(ownerId, id);
  }

  /**
   * DRAFT -> PUBLISHED, checked against the venue's subscription quota.
   *
   * Concurrency: every publish for one venue first locks that venue's row
   * (SELECT ... FOR UPDATE) inside the transaction, so publishes of the same
   * venue run one after another. Only after the lock are the offer, the
   * subscription and the number of active offers read, so two requests for the
   * last free slot can never both see it free. Publishing the same offer twice
   * is harmless: the second request waits for the lock, finds it PUBLISHED and
   * returns it unchanged, without using the quota again.
   */
  async publish(ownerId: string, id: string): Promise<OwnerOffer> {
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const found = await tx.offer.findFirst({
        where: { id, branch: { venue: { ownerId } } },
        select: { branch: { select: { venueId: true } } },
      });
      if (!found) throw offerNotFound();
      const { venueId } = found.branch;

      await tx.$queryRaw`SELECT id FROM "Venue" WHERE id = ${venueId}::uuid FOR UPDATE`;

      // Read again, now that this request holds the lock.
      const offer = await tx.offer.findUniqueOrThrow({
        where: { id },
        include: ownerInclude,
      });
      if (offer.status === 'PUBLISHED') return offer;
      if (offer.status !== 'DRAFT') throw offerConflict('OFFER_NOT_DRAFT');
      if (offer.validUntil <= now) throw offerConflict('OFFER_EXPIRED');

      const subscription = await tx.subscription.findFirst({
        where: { venueId, startsAt: { lte: now }, endsAt: { gt: now } },
        select: { plan: { select: { activeOfferQuota: true } } },
      });
      if (!subscription) throw offerConflict('NO_ACTIVE_SUBSCRIPTION');

      // Active = PUBLISHED and not yet expired (a future start counts too).
      const active = await tx.offer.count({
        where: {
          status: 'PUBLISHED',
          validUntil: { gt: now },
          branch: { venueId },
          NOT: { id },
        },
      });
      if (active >= subscription.plan.activeOfferQuota) {
        throw offerConflict('QUOTA_EXCEEDED');
      }

      return tx.offer.update({
        where: { id },
        data: { status: 'PUBLISHED', publishedAt: now },
        include: ownerInclude,
      });
    });
    return toOwnerOffer(row);
  }

  // --- admin ---------------------------------------------------------------

  async listAll({
    page,
    pageSize,
    status,
  }: ListOffersQuery): Promise<AdminOfferList> {
    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        orderBy: newestFirst,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: adminInclude,
      }),
      this.prisma.offer.count({ where }),
    ]);
    return adminOfferListSchema.parse({
      items: rows.map(toAdminOffer),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  }

  async getAny(id: string): Promise<AdminOffer> {
    const row = await this.prisma.offer.findUnique({
      where: { id },
      include: adminInclude,
    });
    if (!row) throw offerNotFound();
    return toAdminOffer(row);
  }

  /**
   * PUBLISHED -> SUSPENDED with a reason, recording the admin and the time. A
   * suspended offer is no longer PUBLISHED, so it stops counting toward the
   * quota at once. One conditional UPDATE: it can't suspend an offer that
   * isn't published (or twice).
   */
  async suspend(
    adminId: string,
    id: string,
    reason: string,
  ): Promise<AdminOffer> {
    const { count } = await this.prisma.offer.updateMany({
      where: { id, status: 'PUBLISHED' },
      data: {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspensionReason: reason,
        suspendedById: adminId,
      },
    });
    if (count === 0) {
      await this.getAny(id); // 404 if it doesn't exist
      throw offerConflict('OFFER_NOT_PUBLISHED');
    }
    return this.getAny(id);
  }
}
