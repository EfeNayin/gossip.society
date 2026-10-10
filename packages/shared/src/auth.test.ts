import { describe, expect, it } from 'vitest';
import {
  accountStatusErrorCodeSchema,
  loginRequestSchema,
  loginResponseSchema,
  refreshRequestSchema,
  refreshResponseSchema,
  safeUserSchema,
} from './auth';

const dbRow = {
  id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a11',
  email: 'admin@gossip-society.example',
  name: 'Dev Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
  passwordHash: '$argon2id$secret',
  createdAt: new Date(),
};

describe('loginRequestSchema', () => {
  it('trims and lowercases the email', () => {
    const parsed = loginRequestSchema.parse({
      email: '  Admin@Gossip-Society.EXAMPLE ',
      password: 'secret',
    });
    expect(parsed.email).toBe('admin@gossip-society.example');
  });

  it('keeps the password untouched', () => {
    const parsed = loginRequestSchema.parse({
      email: 'a@b.example',
      password: '  Mixed Case  ',
    });
    expect(parsed.password).toBe('  Mixed Case  ');
  });

  it.each([
    { email: 'not-an-email', password: 'x' },
    { email: 'a@b.example', password: '' },
    { email: 'a@b.example', password: 'x'.repeat(257) },
    { email: 'a@b.example' },
    {},
  ])('rejects %j', (body) => {
    expect(loginRequestSchema.safeParse(body).success).toBe(false);
  });

  it('strips client-sent role and status', () => {
    const parsed = loginRequestSchema.parse({
      email: 'a@b.example',
      password: 'x',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    expect(parsed).toEqual({ email: 'a@b.example', password: 'x' });
  });
});

describe('safeUserSchema', () => {
  it('drops passwordHash and other database-only fields', () => {
    const parsed = safeUserSchema.parse(dbRow);
    expect(Object.keys(parsed).sort()).toEqual([
      'email',
      'id',
      'name',
      'role',
      'status',
    ]);
  });

  it('rejects an unknown role', () => {
    expect(
      safeUserSchema.safeParse({ ...dbRow, role: 'SUPERUSER' }).success,
    ).toBe(false);
  });
});

const tokens = {
  accessToken: 'access',
  accessTokenExpiresAt: '2026-10-10T12:00:00.000Z',
  refreshToken: 'refresh',
  refreshTokenExpiresAt: '2026-10-17T12:00:00.000Z',
};

describe('loginResponseSchema', () => {
  it('does not leak passwordHash through the nested user', () => {
    const parsed = loginResponseSchema.parse({ ...tokens, user: dbRow });
    expect(JSON.stringify(parsed)).not.toContain('argon2');
  });

  it('requires both tokens and valid UTC expiry times', () => {
    expect(
      loginResponseSchema.safeParse({
        ...tokens,
        refreshToken: undefined,
        user: dbRow,
      }).success,
    ).toBe(false);
    expect(
      loginResponseSchema.safeParse({
        ...tokens,
        accessTokenExpiresAt: 'tomorrow',
        user: dbRow,
      }).success,
    ).toBe(false);
  });
});

describe('refreshRequestSchema', () => {
  it('accepts a refresh token and strips anything else', () => {
    expect(
      refreshRequestSchema.parse({
        refreshToken: 'abc',
        sessionId: 'x',
        role: 'ADMIN',
      }),
    ).toEqual({ refreshToken: 'abc' });
  });

  it.each([
    {},
    { refreshToken: '' },
    { refreshToken: 'x'.repeat(513) },
    { refreshToken: 5 },
  ])('rejects %j', (body) => {
    expect(refreshRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe('refreshResponseSchema', () => {
  it('has the login response shape', () => {
    expect(
      refreshResponseSchema.safeParse({ ...tokens, user: dbRow }).success,
    ).toBe(true);
  });
});

describe('accountStatusErrorCodeSchema', () => {
  it.each(['ACCOUNT_PENDING', 'ACCOUNT_SUSPENDED'])('accepts %s', (code) => {
    expect(accountStatusErrorCodeSchema.parse(code)).toBe(code);
  });

  it('rejects ACCOUNT_ACTIVE', () => {
    expect(
      accountStatusErrorCodeSchema.safeParse('ACCOUNT_ACTIVE').success,
    ).toBe(false);
  });
});
