import { z } from 'zod';

export const userRoleSchema = z.enum([
  'ADMIN',
  'VENUE_OWNER',
  'VENUE_STAFF',
  'INFLUENCER',
]);

export type UserRole = z.infer<typeof userRoleSchema>;

export const userStatusSchema = z.enum(['ACTIVE', 'PENDING', 'SUSPENDED']);

export type UserStatus = z.infer<typeof userStatusSchema>;
