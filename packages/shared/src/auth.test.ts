import { describe, expect, it } from 'vitest';
import {
  accountStatusErrorCodeSchema,
  loginRequestSchema,
  loginResponseSchema,
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

describe('loginResponseSchema', () => {
  it('does not leak passwordHash through the nested user', () => {
    const parsed = loginResponseSchema.parse({
      accessToken: 'token',
      user: dbRow,
    });
    expect(JSON.stringify(parsed)).not.toContain('argon2');
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
