import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
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

// How long a used Idempotency-Key is remembered. A client that lost an answer
// retries within minutes; a day covers an app restart or a night offline.
// After that the key is forgotten and the same key means a NEW create.
export const IDEMPOTENCY_RETENTION_MS = 24 * 3600 * 1000;
const CREATE_OPERATION = 'offer.create';
// Expired rows removed per keyed create (see purgeExpiredKeys).
const PURGE_BATCH = 100;

// SHA-256 of the normalized body (the schema already trimmed the text and put
// the dates in UTC), with the fields in a fixed order: two bodies that mean
// the same hash the same, whatever the client's key order or whitespace.
export function requestHash(body: CreateOfferRequest): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        body.branchId,
        body.title,
        body.description,
        body.serviceDescription,
        body.serviceValueKurus,
        body.expectedContent,
        body.minFollowers,
        body.capacity,
        body.validFrom,
        body.validUntil,
      ]),
    )
    .digest('hex');
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: unknown }).code === 'P2002';

const dates = ({
  validFrom,
  validUntil,
}: {
  validFrom: string;
  validUntil: string;
}) => ({ validFrom: new Date(validFrom), validUntil: new Date(validUntil) });

/**
 * Locking. Everything that changes a draft or counts toward a venue's quota
 * (publish, edit) takes ONE lock first: the venue's row, FOR UPDATE, inside its
 * transaction. They therefore run one after another per venue, and each decides
 * on data read after the lock. Order: venue row first, then offer rows. No
 * transaction takes a second venue lock or an offer row before the venue, so
 * there is no cycle and no deadlock. Suspending (admin) is a single conditional
 * UPDATE of one offer row and takes no venue lock, so it can't take part in a
 * cycle either: it only ever waits for a row, never holds one while waiting.
 */
@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- venue owner ---------------------------------------------------------

  /**
   * A new DRAFT in one of the caller's own branches.
   *
   * With an `idempotencyKey` the create is safe to repeat (see the
   * IdempotencyKey model): the key is unique per (user, operation), the offer
   * and the key row are written in ONE transaction, and
   *  - the same key and the same body again returns the SAME offer (as it is
   *    now) and creates nothing: `replayed` is true;
   *  - the same key with another body is a 409 IDEMPOTENCY_KEY_REUSED;
   *  - concurrent requests with one key race on the unique index: the loser's
   *    insert waits for the winner to commit, fails with a unique violation,
   *    its transaction (including its offer) is rolled back, and it then
   *    replays the winner's offer. Exactly one offer exists.
   * Nothing here lives in process memory: the database decides.
   */
  async createDraft(
    ownerId: string,
    body: CreateOfferRequest,
    idempotencyKey?: string,
  ): Promise<{ offer: OwnerOffer; replayed: boolean }> {
    if (idempotencyKey === undefined) {
      return {
        offer: await this.insertDraft(this.prisma, ownerId, body),
        replayed: false,
      };
    }

    const hash = requestHash(body);
    const earlier = await this.findKey(ownerId, idempotencyKey);
    if (earlier) return this.replay(ownerId, earlier, hash);
    await this.purgeExpiredKeys();

    // A lost race is retried only to find the winner's row; a few rounds cover
    // the winner's row expiring or being purged in between.
    for (let round = 0; round < 3; round++) {
      try {
        const offer = await this.prisma.$transaction(async (tx) => {
          const now = new Date();
          // An expired row of this very key is forgotten: free the slot.
          await tx.idempotencyKey.deleteMany({
            where: {
              userId: ownerId,
              operation: CREATE_OPERATION,
              key: idempotencyKey,
              expiresAt: { lte: now },
            },
          });
          const created = await this.insertDraft(tx, ownerId, body);
          await tx.idempotencyKey.create({
            data: {
              userId: ownerId,
              operation: CREATE_OPERATION,
              key: idempotencyKey,
              requestHash: hash,
              offerId: created.id,
              expiresAt: new Date(now.getTime() + IDEMPOTENCY_RETENTION_MS),
            },
          });
          return created;
        });
        return { offer, replayed: false };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const winner = await this.findKey(ownerId, idempotencyKey);
        if (winner) return this.replay(ownerId, winner, hash);
      }
    }
    throw new ConflictException('İstek şu anda tamamlanamadı; tekrar deneyin.');
  }

  // The branch must be the caller's, else 404. The status is not part of the
  // data: the column default (DRAFT) applies.
  private async insertDraft(
    db: Pick<PrismaService, 'venueBranch' | 'offer'>,
    ownerId: string,
    { branchId, ...fields }: CreateOfferRequest,
  ): Promise<OwnerOffer> {
    const branch = await db.venueBranch.findFirst({
      where: { id: branchId, venue: { ownerId } },
      select: { id: true },
    });
    if (!branch) throw branchNotFound();

    const row = await db.offer.create({
      data: { ...fields, ...dates(fields), branchId },
      include: ownerInclude,
    });
    return toOwnerOffer(row);
  }

  // A key of THIS user and operation that has not expired.
  private findKey(ownerId: string, key: string) {
    return this.prisma.idempotencyKey.findFirst({
      where: {
        userId: ownerId,
        operation: CREATE_OPERATION,
        key,
        expiresAt: { gt: new Date() },
      },
      select: { requestHash: true, offerId: true },
    });
  }

  private async replay(
    ownerId: string,
    earlier: { requestHash: string; offerId: string },
    hash: string,
  ): Promise<{ offer: OwnerOffer; replayed: true }> {
    if (earlier.requestHash !== hash) {
      throw offerConflict('IDEMPOTENCY_KEY_REUSED');
    }
    return {
      offer: await this.getMine(ownerId, earlier.offerId),
      replayed: true,
    };
  }

  // Expired keys are deleted by later keyed creates, a bounded batch at a time
  // (so a create never waits on a big delete). Best effort: a failure here
  // must not fail the create, and expired rows are ignored by every lookup
  // anyway. If nobody creates, nothing is added, so the table can't grow.
  private async purgeExpiredKeys(): Promise<void> {
    try {
      const expired = await this.prisma.idempotencyKey.findMany({
        where: { expiresAt: { lte: new Date() } },
        select: { id: true },
        take: PURGE_BATCH,
      });
      if (expired.length > 0) {
        await this.prisma.idempotencyKey.deleteMany({
          where: { id: { in: expired.map((row) => row.id) } },
        });
      }
    } catch {
      this.logger.warn('Could not purge expired idempotency keys.');
    }
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

  /**
   * Edits a DRAFT, under the same venue lock as publish() (see "Locking" in
   * the class comment): a draft can't change between the moment a publish has
   * validated it and the moment it publishes it. Ownership and status are
   * checked on the data read after the lock is held.
   */
  async updateDraft(
    ownerId: string,
    id: string,
    fields: UpdateOfferRequest,
  ): Promise<OwnerOffer> {
    const row = await this.prisma.$transaction(async (tx) => {
      const venueId = await this.ownedOfferVenueId(tx, ownerId, id);
      await this.lockVenue(tx, venueId);

      // Read again, now that this request holds the lock.
      const current = await tx.offer.findFirst({
        where: { id, branch: { venue: { ownerId } } },
        select: { status: true },
      });
      if (!current) throw offerNotFound();
      if (current.status !== 'DRAFT') throw offerConflict('OFFER_NOT_DRAFT');

      return tx.offer.update({
        where: { id },
        data: { ...fields, ...dates(fields) },
        include: ownerInclude,
      });
    });
    return toOwnerOffer(row);
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
   *
   * The clock is read after the lock wait too: a request that waited for the
   * lock must judge the subscription, the offer's validity and the quota by the
   * time it actually decides, not by the time it arrived.
   */
  async publish(ownerId: string, id: string): Promise<OwnerOffer> {
    const row = await this.prisma.$transaction(async (tx) => {
      const venueId = await this.ownedOfferVenueId(tx, ownerId, id);
      await this.lockVenue(tx, venueId);

      // From here on everything is read after the lock, with one clock reading.
      const now = new Date();
      const offer = await tx.offer.findFirst({
        where: { id, branch: { venue: { ownerId } } },
        include: ownerInclude,
      });
      if (!offer) throw offerNotFound();
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

  // The venue of an offer the caller owns (404 otherwise). Read BEFORE the lock
  // only to know which row to lock; ownership is checked again after it. A
  // branch never changes venue, so the id can't go stale.
  private async ownedOfferVenueId(
    tx: Pick<PrismaService, 'offer'>,
    ownerId: string,
    id: string,
  ): Promise<string> {
    const found = await tx.offer.findFirst({
      where: { id, branch: { venue: { ownerId } } },
      select: { branch: { select: { venueId: true } } },
    });
    if (!found) throw offerNotFound();
    return found.branch.venueId;
  }

  private async lockVenue(
    tx: Pick<PrismaService, '$queryRaw'>,
    venueId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "Venue" WHERE id = ${venueId}::uuid FOR UPDATE`;
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
