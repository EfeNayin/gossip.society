import { z } from 'zod';
import { userRoleSchema, userStatusSchema } from './user';

// Upper bound for passwords, shared by login and the dev password command.
// It keeps absurdly long input away from the password hasher.
export const MAX_PASSWORD_LENGTH = 256;

// Unknown keys (e.g. a client-sent `role` or `status`) are stripped, never read.
export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

// Parsing a database row with this schema drops everything not listed here
// (passwordHash included), so it is the only shape allowed in API responses.
export const safeUserSchema = z.object({
  id: z.guid(),
  email: z.string(),
  name: z.string(),
  role: userRoleSchema,
  status: userStatusSchema,
});

export type SafeUser = z.infer<typeof safeUserSchema>;

// Opaque tokens as issued by login and refresh. Expiry times are UTC ISO
// strings. refreshTokenExpiresAt is the session's absolute end: refreshing
// never extends it, and accessTokenExpiresAt never goes past it.
export const authTokensSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.iso.datetime(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.iso.datetime(),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;

export const loginResponseSchema = authTokensSchema.extend({
  user: safeUserSchema,
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).max(512),
});

export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

// Same shape as login: a new token pair plus the current safe user.
export const refreshResponseSchema = loginResponseSchema;

export type RefreshResponse = LoginResponse;

// 403 codes for a valid login on an account that cannot be used yet.
export const accountStatusErrorCodeSchema = z.enum([
  'ACCOUNT_PENDING',
  'ACCOUNT_SUSPENDED',
]);

export type AccountStatusErrorCode = z.infer<
  typeof accountStatusErrorCodeSchema
>;

export const accountStatusErrorSchema = z.object({
  statusCode: z.literal(403),
  code: accountStatusErrorCodeSchema,
  message: z.string(),
});

export type AccountStatusError = z.infer<typeof accountStatusErrorSchema>;
