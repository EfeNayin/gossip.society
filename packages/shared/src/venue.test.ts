import { describe, expect, it } from 'vitest';
import { MAX_PASSWORD_LENGTH } from './auth';
import {
  adminVenueSchema,
  createVenueRequestSchema,
  listVenuesQuerySchema,
  MAX_ADDRESS_LENGTH,
  MAX_VENUE_PAGE_SIZE,
  myVenueSchema,
} from './venue';

const valid = {
  owner: {
    name: 'Ayşe Yılmaz',
    email: 'ayse@kafe.example',
    password: 'a-long-initial-password',
  },
  venue: { name: 'Örnek Kafe', description: 'Kadıköy’de bir kafe' },
  branch: { name: 'Kadıköy', city: 'İstanbul', address: 'Örnek Sokak No: 1' },
};

describe('createVenueRequestSchema', () => {
  it('accepts a complete request', () => {
    expect(createVenueRequestSchema.parse(valid)).toEqual(valid);
  });

  it('trims and lowercases the owner e-mail and trims the texts', () => {
    const parsed = createVenueRequestSchema.parse({
      ...valid,
      owner: {
        ...valid.owner,
        name: '  Ayşe  ',
        email: '  Ayse@Kafe.EXAMPLE ',
      },
      branch: { ...valid.branch, city: ' İstanbul ' },
    });
    expect(parsed.owner.email).toBe('ayse@kafe.example');
    expect(parsed.owner.name).toBe('Ayşe');
    expect(parsed.branch.city).toBe('İstanbul');
  });

  it('keeps the password exactly as typed (no trimming)', () => {
    const password = '  spaces are part of it  ';
    const parsed = createVenueRequestSchema.parse({
      ...valid,
      owner: { ...valid.owner, password },
    });
    expect(parsed.owner.password).toBe(password);
  });

  it('enforces the password length: at least 12, at most MAX_PASSWORD_LENGTH', () => {
    const withPassword = (password: string) =>
      createVenueRequestSchema.safeParse({
        ...valid,
        owner: { ...valid.owner, password },
      }).success;
    expect(withPassword('x'.repeat(11))).toBe(false);
    expect(withPassword('x'.repeat(12))).toBe(true);
    expect(withPassword('x'.repeat(MAX_PASSWORD_LENGTH))).toBe(true);
    expect(withPassword('x'.repeat(MAX_PASSWORD_LENGTH + 1))).toBe(false);
  });

  it('a password is not trimmed, so 12 spaces meet the length rule', () => {
    expect(
      createVenueRequestSchema.safeParse({
        ...valid,
        owner: { ...valid.owner, password: ' '.repeat(12) },
      }).success,
    ).toBe(true);
  });

  it('treats an empty or missing description as no description', () => {
    expect(
      createVenueRequestSchema.parse({
        ...valid,
        venue: { name: 'X', description: '   ' },
      }).venue.description,
    ).toBeUndefined();
    expect(
      createVenueRequestSchema.parse({ ...valid, venue: { name: 'X' } }).venue
        .description,
    ).toBeUndefined();
  });

  it.each([
    ['empty owner name', { ...valid, owner: { ...valid.owner, name: '   ' } }],
    ['invalid e-mail', { ...valid, owner: { ...valid.owner, email: 'nope' } }],
    ['empty venue name', { ...valid, venue: { name: '' } }],
    [
      'too long description',
      { ...valid, venue: { name: 'X', description: 'x'.repeat(1001) } },
    ],
    ['empty branch city', { ...valid, branch: { ...valid.branch, city: '' } }],
    [
      'too long address',
      {
        ...valid,
        branch: {
          ...valid.branch,
          address: 'x'.repeat(MAX_ADDRESS_LENGTH + 1),
        },
      },
    ],
    ['missing branch', { owner: valid.owner, venue: valid.venue }],
  ])('rejects %s', (_label, body) => {
    expect(createVenueRequestSchema.safeParse(body).success).toBe(false);
  });

  it('strips client-sent role, status and ownerId at every level', () => {
    const parsed = createVenueRequestSchema.parse({
      ...valid,
      role: 'ADMIN',
      status: 'ACTIVE',
      ownerId: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a11',
      owner: { ...valid.owner, role: 'ADMIN', status: 'SUSPENDED', id: 'x' },
      venue: { ...valid.venue, ownerId: 'x' },
    });
    expect(JSON.stringify(parsed)).not.toMatch(/ADMIN|SUSPENDED|ownerId|"id"/);
  });
});

describe('listVenuesQuerySchema', () => {
  it('defaults to the first page of 20', () => {
    expect(listVenuesQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('coerces query strings', () => {
    expect(listVenuesQuerySchema.parse({ page: '3', pageSize: '10' })).toEqual({
      page: 3,
      pageSize: 10,
    });
  });

  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { pageSize: '0' },
    { pageSize: String(MAX_VENUE_PAGE_SIZE + 1) },
    { page: 'abc' },
  ])('rejects %j', (query) => {
    expect(listVenuesQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('response schemas', () => {
  const row = {
    id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a11',
    name: 'Örnek Kafe',
    description: null,
    createdAt: new Date('2026-10-10T12:00:00Z'),
    ownerId: 'x',
    owner: {
      id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a12',
      name: 'Ayşe',
      email: 'ayse@kafe.example',
      status: 'ACTIVE',
      passwordHash: '$argon2id$secret',
      role: 'VENUE_OWNER',
    },
    branches: [
      {
        id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a13',
        name: 'K',
        city: 'C',
        address: 'A',
        venueId: 'x',
      },
    ],
  };

  it('drops the owner password hash and database-only fields', () => {
    const parsed = adminVenueSchema.parse(row);
    expect(JSON.stringify(parsed)).not.toMatch(
      /argon2|passwordHash|ownerId|venueId|role/,
    );
    expect(parsed.createdAt).toBe('2026-10-10T12:00:00.000Z');
  });

  it("the owner's own view has no owner block", () => {
    expect(Object.keys(myVenueSchema.parse(row)).sort()).toEqual([
      'branches',
      'createdAt',
      'description',
      'id',
      'name',
    ]);
  });
});
