import { describe, expect, it } from 'vitest';
import { userRoleSchema, userStatusSchema } from './user';

describe('userRoleSchema', () => {
  it.each(['ADMIN', 'VENUE_OWNER', 'VENUE_STAFF', 'INFLUENCER'])(
    'accepts %s',
    (role) => {
      expect(userRoleSchema.parse(role)).toBe(role);
    },
  );

  it.each(['admin', 'VENUE', 'OWNER', '', null])('rejects %j', (role) => {
    expect(userRoleSchema.safeParse(role).success).toBe(false);
  });
});

describe('userStatusSchema', () => {
  it.each(['ACTIVE', 'PENDING', 'SUSPENDED'])('accepts %s', (status) => {
    expect(userStatusSchema.parse(status)).toBe(status);
  });

  it.each(['active', 'BANNED', 'DELETED', undefined])(
    'rejects %j',
    (status) => {
      expect(userStatusSchema.safeParse(status).success).toBe(false);
    },
  );
});
