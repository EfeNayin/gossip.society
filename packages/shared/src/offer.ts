import { z } from 'zod';

// Keep the status values in sync with the OfferStatus enum in the Prisma
// schema (apps/api/src/offers/offer-enum-parity.spec.ts fails when they drift).
export const offerStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'SUSPENDED']);
export type OfferStatus = z.infer<typeof offerStatusSchema>;

export const MAX_OFFER_TITLE_LENGTH = 120;
export const MAX_OFFER_DESCRIPTION_LENGTH = 2000;
export const MAX_OFFER_SERVICE_LENGTH = 300;
export const MAX_OFFER_EXPECTED_CONTENT_LENGTH = 1000;
export const MAX_SUSPENSION_REASON_LENGTH = 500;
// Money is an integer number of kuruş (never a float): 100,000,000 = 1 million TL.
export const MAX_SERVICE_VALUE_KURUS = 100_000_000;
export const MAX_MIN_FOLLOWERS = 100_000_000;
export const MAX_OFFER_CAPACITY = 10_000;

export const MAX_OFFER_PAGE_SIZE = 50;
export const DEFAULT_OFFER_PAGE_SIZE = 20;

const requiredText = (max: number) => z.string().trim().min(1).max(max);

// ISO 8601 with a zone ("Z" or an offset); normalized to UTC ("...Z").
const utcDateTime = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());

// A DB date (Date or ISO string) rendered as a UTC ISO string.
const dateOut = z.coerce.date().transform((date) => date.toISOString());

const offerFields = z.object({
  title: requiredText(MAX_OFFER_TITLE_LENGTH),
  description: requiredText(MAX_OFFER_DESCRIPTION_LENGTH),
  // The service the venue gives the influencer, e.g. "İki kişilik akşam yemeği".
  serviceDescription: requiredText(MAX_OFFER_SERVICE_LENGTH),
  // The value of that service in kuruş (an integer, must be positive).
  serviceValueKurus: z.number().int().min(1).max(MAX_SERVICE_VALUE_KURUS),
  expectedContent: requiredText(MAX_OFFER_EXPECTED_CONTENT_LENGTH),
  minFollowers: z.number().int().min(0).max(MAX_MIN_FOLLOWERS),
  capacity: z.number().int().min(1).max(MAX_OFFER_CAPACITY),
  validFrom: utcDateTime,
  validUntil: utcDateTime,
});

const validRange = (value: { validFrom: string; validUntil: string }) =>
  Date.parse(value.validUntil) > Date.parse(value.validFrom);
const rangeIssue = {
  path: ['validUntil'],
  message: 'validUntil must be after validFrom',
};

/**
 * Body of POST /offers/mine (a new DRAFT). Unknown keys (status, ownerId,
 * venueId, publishedAt, suspension fields...) are stripped: an offer always
 * starts as a DRAFT of one of the caller's own branches.
 */
export const createOfferRequestSchema = offerFields
  .extend({ branchId: z.guid() })
  .refine(validRange, rangeIssue);

export type CreateOfferRequest = z.infer<typeof createOfferRequestSchema>;

/** Body of PUT /offers/mine/:id: the full set of editable fields (branch can't change). */
export const updateOfferRequestSchema = offerFields.refine(
  validRange,
  rangeIssue,
);

export type UpdateOfferRequest = z.infer<typeof updateOfferRequestSchema>;

export const listOffersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_OFFER_PAGE_SIZE)
    .default(DEFAULT_OFFER_PAGE_SIZE),
  status: offerStatusSchema.optional(),
});

export type ListOffersQuery = z.infer<typeof listOffersQuerySchema>;

/** Body of POST /admin/offers/:id/suspend: the reason is required. */
export const suspendOfferRequestSchema = z.object({
  reason: requiredText(MAX_SUSPENSION_REASON_LENGTH),
});

export type SuspendOfferRequest = z.infer<typeof suspendOfferRequestSchema>;

const offerBranchSchema = z.object({
  id: z.guid(),
  name: z.string(),
  city: z.string(),
});

const offerVenueSchema = z.object({ id: z.guid(), name: z.string() });

const offerBodySchema = z.object({
  id: z.guid(),
  branch: offerBranchSchema,
  title: z.string(),
  description: z.string(),
  serviceDescription: z.string(),
  serviceValueKurus: z.number().int(),
  expectedContent: z.string(),
  minFollowers: z.number().int(),
  capacity: z.number().int(),
  validFrom: dateOut,
  validUntil: dateOut,
  status: offerStatusSchema,
  publishedAt: dateOut.nullable(),
  createdAt: dateOut,
  updatedAt: dateOut,
});

// Parsing a database row with these schemas drops everything not listed (no
// internal ids of other users, no password hashes): they are the only shapes
// allowed in responses.

/** An offer as its owner sees it. A suspension shows the reason and time, not the admin. */
export const ownerOfferSchema = offerBodySchema.extend({
  venue: offerVenueSchema,
  suspension: z.object({ reason: z.string(), suspendedAt: dateOut }).nullable(),
});

export type OwnerOffer = z.infer<typeof ownerOfferSchema>;

/** An offer as an admin sees it: with the venue's owner and who suspended it. */
export const adminOfferSchema = offerBodySchema.extend({
  venue: offerVenueSchema.extend({
    owner: z.object({ id: z.guid(), name: z.string(), email: z.string() }),
  }),
  suspension: z
    .object({
      reason: z.string(),
      suspendedAt: dateOut,
      suspendedBy: z.object({ id: z.guid(), name: z.string() }),
    })
    .nullable(),
});

export type AdminOffer = z.infer<typeof adminOfferSchema>;

const page = {
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
};

export const ownerOfferListSchema = z.object({
  items: z.array(ownerOfferSchema),
  ...page,
});
export type OwnerOfferList = z.infer<typeof ownerOfferListSchema>;

export const adminOfferListSchema = z.object({
  items: z.array(adminOfferSchema),
  ...page,
});
export type AdminOfferList = z.infer<typeof adminOfferListSchema>;

// 409 bodies of the publish and suspend endpoints (and edit of a non-draft).
export const offerErrorCodeSchema = z.enum([
  // Publishing needs a subscription that is valid right now.
  'NO_ACTIVE_SUBSCRIPTION',
  // The subscription's active-offer quota is used up.
  'QUOTA_EXCEEDED',
  // Only a DRAFT can be edited or published.
  'OFFER_NOT_DRAFT',
  // The offer's validity already ended.
  'OFFER_EXPIRED',
  // Only a PUBLISHED offer can be suspended.
  'OFFER_NOT_PUBLISHED',
]);
export type OfferErrorCode = z.infer<typeof offerErrorCodeSchema>;

export const offerErrorSchema = z.object({
  statusCode: z.literal(409),
  code: offerErrorCodeSchema,
  message: z.string(),
});
export type OfferError = z.infer<typeof offerErrorSchema>;
