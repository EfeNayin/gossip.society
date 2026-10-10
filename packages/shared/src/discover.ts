import { z } from 'zod';
import { DEFAULT_OFFER_PAGE_SIZE, MAX_OFFER_PAGE_SIZE } from './offer';

// What an INFLUENCER may see of an offer: only offers that are PUBLISHED and
// currently valid (validFrom <= now < validUntil). These are the only shapes
// allowed in the discovery responses: nothing about the venue owner, any user,
// the subscription, the status history or an admin is ever part of them.
//
// There is no application model yet, so `capacity` is the TOTAL number of
// places the venue offers, never "places left". `minFollowers` is a condition
// shown to the influencer; nothing checks it automatically.

const dateOut = z.coerce.date().transform((date) => date.toISOString());

/** Query of GET /discover/offers. */
export const discoverQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_OFFER_PAGE_SIZE)
    .default(DEFAULT_OFFER_PAGE_SIZE),
});
export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;

/** A card in the discovery list. */
export const discoverOfferSummarySchema = z.object({
  id: z.guid(),
  title: z.string(),
  serviceDescription: z.string(),
  // Kuruş (an integer), never a float.
  serviceValueKurus: z.number().int(),
  expectedContent: z.string(),
  minFollowers: z.number().int(),
  validFrom: dateOut,
  validUntil: dateOut,
  venue: z.object({ name: z.string() }),
  branch: z.object({ name: z.string(), city: z.string() }),
});
export type DiscoverOfferSummary = z.infer<typeof discoverOfferSummarySchema>;

/** The detail of one visible offer. */
export const discoverOfferSchema = discoverOfferSummarySchema.extend({
  description: z.string(),
  capacity: z.number().int(),
  branch: z.object({
    name: z.string(),
    city: z.string(),
    address: z.string(),
  }),
});
export type DiscoverOffer = z.infer<typeof discoverOfferSchema>;

export const discoverOfferListSchema = z.object({
  items: z.array(discoverOfferSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type DiscoverOfferList = z.infer<typeof discoverOfferListSchema>;
