import { z } from 'zod';
import { DEFAULT_OFFER_PAGE_SIZE, MAX_OFFER_PAGE_SIZE } from './offer';

// Keep the status values in sync with the CollaborationStatus enum in the
// Prisma schema (apps/api/src/collaborations/collaboration-enum-parity.spec.ts
// fails when they drift). Only the states that exist today: the later states of
// the plan are added by the tasks that implement them.
export const collaborationStatusSchema = z.enum([
  'APPLIED',
  'APPROVED',
  'REJECTED',
]);
export type CollaborationStatus = z.infer<typeof collaborationStatusSchema>;

const dateOut = z.coerce.date().transform((date) => date.toISOString());

/**
 * The offer terms the influencer accepted, taken from the offer ON THE SERVER at
 * the moment of the application and stored with it. The client never sends
 * these: it only declares that it accepts them.
 */
export const collaborationTermsSchema = z.object({
  title: z.string(),
  serviceDescription: z.string(),
  // Kuruş (an integer), never a float.
  serviceValueKurus: z.number().int(),
  expectedContent: z.string(),
  minFollowers: z.number().int(),
  validFrom: dateOut,
  validUntil: dateOut,
});
export type CollaborationTerms = z.infer<typeof collaborationTermsSchema>;

/**
 * Body of POST /collaborations/mine. The influencer is the authenticated user;
 * the status, the terms, the venue and the times are never taken from the body
 * (unknown keys are stripped). `acceptTerms` must be exactly `true`: the user
 * has to say explicitly that they accept the offer's terms.
 */
export const createCollaborationRequestSchema = z.object({
  offerId: z.guid(),
  acceptTerms: z.literal(true),
});
export type CreateCollaborationRequest = z.infer<
  typeof createCollaborationRequestSchema
>;

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_OFFER_PAGE_SIZE)
    .default(DEFAULT_OFFER_PAGE_SIZE),
};

/** Query of GET /collaborations/mine. */
export const listMyCollaborationsQuerySchema = z.object({
  ...pageQuery,
  status: collaborationStatusSchema.optional(),
});
export type ListMyCollaborationsQuery = z.infer<
  typeof listMyCollaborationsQuerySchema
>;

/** Query of GET /collaborations/received (the venue owner's inbox). */
export const listReceivedCollaborationsQuerySchema = z.object({
  ...pageQuery,
  status: collaborationStatusSchema.optional(),
  offerId: z.guid().optional(),
});
export type ListReceivedCollaborationsQuery = z.infer<
  typeof listReceivedCollaborationsQuerySchema
>;

/** One entry of a collaboration's history (who did it is not exposed). */
export const collaborationEventSchema = z.object({
  fromStatus: collaborationStatusSchema.nullable(),
  toStatus: collaborationStatusSchema,
  createdAt: dateOut,
});
export type CollaborationEvent = z.infer<typeof collaborationEventSchema>;

// --- what an influencer reads (their own applications) -----------------------

const influencerOfferRef = z.object({
  id: z.guid(),
  title: z.string(),
  venue: z.object({ name: z.string() }),
  branch: z.object({ name: z.string(), city: z.string() }),
});

export const myCollaborationSummarySchema = z.object({
  id: z.guid(),
  status: collaborationStatusSchema,
  appliedAt: dateOut,
  decidedAt: dateOut.nullable(),
  offer: influencerOfferRef,
});
export type MyCollaborationSummary = z.infer<
  typeof myCollaborationSummarySchema
>;

export const myCollaborationSchema = myCollaborationSummarySchema.extend({
  termsAcceptedAt: dateOut,
  terms: collaborationTermsSchema,
  history: z.array(collaborationEventSchema),
});
export type MyCollaboration = z.infer<typeof myCollaborationSchema>;

// --- what a venue owner reads (applications to their own offers) --------------

const receivedOfferRef = z.object({
  id: z.guid(),
  title: z.string(),
  branch: z.object({ name: z.string(), city: z.string() }),
});

// Only what is needed to judge an applicant. There is NO follower count, score
// or verification: none exists yet. `instagramUsername` is what the influencer
// wrote about themselves and is NOT verified. No e-mail, no ids.
const applicantSummary = z.object({ name: z.string() });
export const applicantProfileSchema = z.object({
  city: z.string(),
  bio: z.string().nullable(),
  instagramUsername: z.string().nullable(),
});

export const receivedCollaborationSummarySchema = z.object({
  id: z.guid(),
  status: collaborationStatusSchema,
  appliedAt: dateOut,
  decidedAt: dateOut.nullable(),
  offer: receivedOfferRef,
  applicant: applicantSummary,
});
export type ReceivedCollaborationSummary = z.infer<
  typeof receivedCollaborationSummarySchema
>;

export const receivedCollaborationSchema =
  receivedCollaborationSummarySchema.extend({
    termsAcceptedAt: dateOut,
    terms: collaborationTermsSchema,
    applicant: applicantSummary.extend({
      profile: applicantProfileSchema.nullable(),
    }),
    history: z.array(collaborationEventSchema),
  });
export type ReceivedCollaboration = z.infer<typeof receivedCollaborationSchema>;

const page = {
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
};

export const myCollaborationListSchema = z.object({
  items: z.array(myCollaborationSummarySchema),
  ...page,
});
export type MyCollaborationList = z.infer<typeof myCollaborationListSchema>;

export const receivedCollaborationListSchema = z.object({
  items: z.array(receivedCollaborationSummarySchema),
  ...page,
});
export type ReceivedCollaborationList = z.infer<
  typeof receivedCollaborationListSchema
>;

// 409 bodies. A hidden or foreign offer / collaboration is a plain 404, like
// everywhere else; these are the business rules.
export const collaborationErrorCodeSchema = z.enum([
  // This influencer already applied to this offer (also after a rejection:
  // there is no second application).
  'ALREADY_APPLIED',
  // The offer is not open right now: not PUBLISHED, not started yet or ended.
  'OFFER_NOT_OPEN',
  // The venue has no subscription that is valid right now.
  'NO_ACTIVE_SUBSCRIPTION',
  // The offer's approved collaborations already fill its capacity.
  'OFFER_CAPACITY_FULL',
  // The venue's monthly match quota (Europe/Istanbul month) is used up.
  'MONTHLY_QUOTA_EXCEEDED',
  // The applicant is no longer an ACTIVE influencer.
  'APPLICANT_NOT_ELIGIBLE',
  // The opposite decision was already made.
  'COLLABORATION_ALREADY_APPROVED',
  'COLLABORATION_ALREADY_REJECTED',
]);
export type CollaborationErrorCode = z.infer<
  typeof collaborationErrorCodeSchema
>;

export const collaborationErrorSchema = z.object({
  statusCode: z.literal(409),
  code: collaborationErrorCodeSchema,
  message: z.string(),
});
export type CollaborationError = z.infer<typeof collaborationErrorSchema>;
