import { z } from 'zod';
import { MAX_PASSWORD_LENGTH, safeUserSchema } from './auth';

// Length limits for the venue-creation form, enforced by the API as well.
export const MIN_INITIAL_PASSWORD_LENGTH = 12;
export const MAX_PERSON_NAME_LENGTH = 120;
export const MAX_VENUE_NAME_LENGTH = 120;
export const MAX_VENUE_DESCRIPTION_LENGTH = 1000;
export const MAX_BRANCH_NAME_LENGTH = 120;
export const MAX_CITY_LENGTH = 80;
export const MAX_ADDRESS_LENGTH = 300;

export const MAX_VENUE_PAGE_SIZE = 50;
export const DEFAULT_VENUE_PAGE_SIZE = 20;

const requiredText = (max: number) => z.string().trim().min(1).max(max);

// "" from an empty form field means "no description".
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value ? value : undefined))
    .optional();

/**
 * Body of POST /admin/venues. Unknown keys (role, status, ownerId, ...) are
 * stripped, so a client can't decide the new account's role or status: the API
 * always creates a VENUE_OWNER that is ACTIVE.
 *
 * The initial password is chosen by the admin and handed to the owner outside
 * the app. It is NOT trimmed (spaces are allowed), and it is never returned.
 */
export const createVenueRequestSchema = z.object({
  owner: z.object({
    name: requiredText(MAX_PERSON_NAME_LENGTH),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z
      .string()
      .min(MIN_INITIAL_PASSWORD_LENGTH)
      .max(MAX_PASSWORD_LENGTH),
  }),
  venue: z.object({
    name: requiredText(MAX_VENUE_NAME_LENGTH),
    description: optionalText(MAX_VENUE_DESCRIPTION_LENGTH),
  }),
  branch: z.object({
    name: requiredText(MAX_BRANCH_NAME_LENGTH),
    city: requiredText(MAX_CITY_LENGTH),
    address: requiredText(MAX_ADDRESS_LENGTH),
  }),
});

export type CreateVenueRequest = z.infer<typeof createVenueRequestSchema>;

export const venueBranchSchema = z.object({
  id: z.guid(),
  name: z.string(),
  city: z.string(),
  address: z.string(),
});

export type VenueBranch = z.infer<typeof venueBranchSchema>;

// Parsing a database row with these schemas drops everything not listed (the
// owner's passwordHash included): they are the only shapes allowed in responses.
export const venueOwnerSchema = safeUserSchema.pick({
  id: true,
  name: true,
  email: true,
  status: true,
});

export const adminVenueSchema = z.object({
  id: z.guid(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.coerce.date().transform((date) => date.toISOString()),
  owner: venueOwnerSchema,
  branches: z.array(venueBranchSchema),
});

export type AdminVenue = z.infer<typeof adminVenueSchema>;

export const createVenueResponseSchema = adminVenueSchema;
export type CreateVenueResponse = AdminVenue;

/** Query of GET /admin/venues. Page size is capped. */
export const listVenuesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_VENUE_PAGE_SIZE)
    .default(DEFAULT_VENUE_PAGE_SIZE),
});

export type ListVenuesQuery = z.infer<typeof listVenuesQuerySchema>;

export const adminVenueListSchema = z.object({
  items: z.array(adminVenueSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export type AdminVenueList = z.infer<typeof adminVenueListSchema>;

// GET /venues/mine: the signed-in owner's own venues (the owner is the caller,
// so there is no owner block).
export const myVenueSchema = z.object({
  id: z.guid(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.coerce.date().transform((date) => date.toISOString()),
  branches: z.array(venueBranchSchema),
});

export type MyVenue = z.infer<typeof myVenueSchema>;

export const myVenuesResponseSchema = z.object({
  items: z.array(myVenueSchema),
});

export type MyVenuesResponse = z.infer<typeof myVenuesResponseSchema>;

// 409 body when the owner's e-mail already belongs to an account.
export const venueErrorCodeSchema = z.enum(['EMAIL_ALREADY_EXISTS']);
export type VenueErrorCode = z.infer<typeof venueErrorCodeSchema>;

export const emailConflictErrorSchema = z.object({
  statusCode: z.literal(409),
  code: venueErrorCodeSchema,
  message: z.string(),
});

export type EmailConflictError = z.infer<typeof emailConflictErrorSchema>;
