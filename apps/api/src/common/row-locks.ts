import type { PrismaService } from '../prisma/prisma.service.js';

type Tx = Pick<PrismaService, '$queryRaw'>;

/**
 * The row locks of the offer / collaboration transactions, in ONE place with
 * ONE order. Every transaction that takes more than one of them takes them in
 * this order, and each takes a subsequence of it, so there is no cycle and no
 * deadlock:
 *
 *   1. venue          FOR UPDATE   serializes everything that counts a venue's
 *                                  quota: publish, draft edit, approve
 *   2. offer          FOR SHARE    makes an offer's visibility stable for the
 *                                  transaction: the admin's suspend is a single
 *                                  UPDATE of this row, so it waits for (or is
 *                                  seen by) apply and approve. Many applies
 *                                  share it.
 *   3. collaboration  FOR UPDATE   one decision at a time per collaboration
 *   4. user           FOR SHARE    the applicant's status can't change under an
 *                                  approval
 *
 * Who takes what: publish / edit draft = 1; apply = 2; approve = 1, 2, 3, 4;
 * reject = 3; suspend = none of these (one conditional UPDATE on the offer row,
 * which only ever waits for a row, never holds one while waiting for a lock
 * above). Read-after-lock: under READ COMMITTED a statement that ran after the
 * lock was granted sees everything committed before it, so callers read the
 * data they decide on AFTER the lock, and read the clock after it too.
 */
export const lockVenue = async (tx: Tx, id: string): Promise<void> => {
  await tx.$queryRaw`SELECT id FROM "Venue" WHERE id = ${id}::uuid FOR UPDATE`;
};

export const lockOfferShared = async (tx: Tx, id: string): Promise<void> => {
  await tx.$queryRaw`SELECT id FROM "Offer" WHERE id = ${id}::uuid FOR SHARE`;
};

export const lockCollaboration = async (tx: Tx, id: string): Promise<void> => {
  await tx.$queryRaw`SELECT id FROM "Collaboration" WHERE id = ${id}::uuid FOR UPDATE`;
};

export const lockUserShared = async (tx: Tx, id: string): Promise<void> => {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR SHARE`;
};
