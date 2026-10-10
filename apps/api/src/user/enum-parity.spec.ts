import { userRoleSchema, userStatusSchema } from '@gossip/shared';
import { UserRole, UserStatus } from '../generated/prisma/enums.js';

describe('Prisma enums match the shared schemas', () => {
  it('has the same user roles', () => {
    expect(Object.values(UserRole).sort()).toEqual(
      [...userRoleSchema.options].sort(),
    );
  });

  it('has the same user statuses', () => {
    expect(Object.values(UserStatus).sort()).toEqual(
      [...userStatusSchema.options].sort(),
    );
  });
});
