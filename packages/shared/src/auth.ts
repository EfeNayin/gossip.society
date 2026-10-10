import { z } from 'zod';
import { userRoleSchema, userStatusSchema } from './user';

// Unknown keys (e.g. a client-sent `role` or `status`) are stripped, never read.
export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  // The upper bound keeps absurdly long input away from the password hasher.
  password: z.string().min(1).max(256),
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

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: safeUserSchema,
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

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
