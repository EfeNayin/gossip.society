import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@gossip/shared';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given roles (checked against the database role).
 * This is a role check only. It does NOT prove the user owns or staffs the
 * venue/branch being accessed; services must check that ownership themselves.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
