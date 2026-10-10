import { describe, expect, it } from 'vitest';
import {
  adminOfferSchema,
  createOfferRequestSchema,
  idempotencyKeySchema,
  listOffersQuerySchema,
  MAX_OFFER_CAPACITY,
  MAX_SERVICE_VALUE_KURUS,
  offerErrorSchema,
  offerStatusSchema,
  ownerOfferSchema,
  suspendOfferRequestSchema,
  updateOfferRequestSchema,
} from './offer';

const valid = {
  branchId: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a11',
  title: 'Akşam yemeği',
  description: 'İki kişilik akşam yemeği daveti',
  serviceDescription: 'İki kişilik tadım menüsü',
  serviceValueKurus: 250_000,
  expectedContent: 'Bir reels videosu ve üç story',
  minFollowers: 5000,
  capacity: 4,
  validFrom: '2026-11-01T09:00:00.000Z',
  validUntil: '2026-12-01T09:00:00.000Z',
};

describe('offerStatusSchema', () => {
  it.each(['DRAFT', 'PUBLISHED', 'SUSPENDED'])('accepts %s', (status) => {
    expect(offerStatusSchema.parse(status)).toBe(status);
  });
  it.each(['draft', 'ACTIVE', 'EXPIRED', '', null])('rejects %j', (status) => {
    expect(offerStatusSchema.safeParse(status).success).toBe(false);
  });
});

describe('createOfferRequestSchema', () => {
  it('accepts a complete request', () => {
    expect(createOfferRequestSchema.parse(valid)).toEqual(valid);
  });

  it('normalizes dates to UTC', () => {
    const parsed = createOfferRequestSchema.parse({
      ...valid,
      validFrom: '2026-11-01T12:00:00+03:00',
      validUntil: '2026-12-01T12:00:00+03:00',
    });
    expect(parsed.validFrom).toBe('2026-11-01T09:00:00.000Z');
    expect(parsed.validUntil).toBe('2026-12-01T09:00:00.000Z');
  });

  it('trims texts', () => {
    expect(
      createOfferRequestSchema.parse({ ...valid, title: '  Başlık  ' }).title,
    ).toBe('Başlık');
  });

  it.each([
    ['a date without a zone', { validFrom: '2026-11-01T09:00:00' }],
    ['a date that is not a date', { validUntil: 'yarın' }],
    ['an end equal to the start', { validUntil: valid.validFrom }],
    ['an end before the start', { validUntil: '2026-10-01T09:00:00.000Z' }],
    ['a zero service value', { serviceValueKurus: 0 }],
    ['a negative service value', { serviceValueKurus: -100 }],
    [
      'a fractional service value (money is whole kuruş)',
      { serviceValueKurus: 1999.5 },
    ],
    [
      'a too large service value',
      { serviceValueKurus: MAX_SERVICE_VALUE_KURUS + 1 },
    ],
    ['a zero capacity', { capacity: 0 }],
    ['a fractional capacity', { capacity: 1.5 }],
    ['a too large capacity', { capacity: MAX_OFFER_CAPACITY + 1 }],
    ['negative minimum followers', { minFollowers: -1 }],
    ['an empty title', { title: '   ' }],
    ['a too long title', { title: 'x'.repeat(121) }],
    ['a too long description', { description: 'x'.repeat(2001) }],
    ['a service value sent as a string', { serviceValueKurus: '2500' }],
    ['a bad branch id', { branchId: 'nope' }],
  ])('rejects %s', (_label, override) => {
    expect(
      createOfferRequestSchema.safeParse({ ...valid, ...override }).success,
    ).toBe(false);
  });

  it('allows zero minimum followers', () => {
    expect(
      createOfferRequestSchema.safeParse({ ...valid, minFollowers: 0 }).success,
    ).toBe(true);
  });

  it('strips status, ids, publish and admin fields the client may try to send', () => {
    const parsed = createOfferRequestSchema.parse({
      ...valid,
      status: 'PUBLISHED',
      ownerId: 'x',
      venueId: 'x',
      publishedAt: '2026-01-01T00:00:00Z',
      suspendedById: 'x',
      suspensionReason: 'x',
    });
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(valid).sort());
  });
});

describe('updateOfferRequestSchema', () => {
  const { branchId: _branch, ...fields } = valid;
  void _branch;

  it('takes the editable fields and ignores a branch change', () => {
    expect(
      updateOfferRequestSchema.parse({ ...fields, branchId: 'x' }),
    ).toEqual(fields);
  });

  it('applies the same value and date rules', () => {
    expect(
      updateOfferRequestSchema.safeParse({
        ...fields,
        validUntil: fields.validFrom,
      }).success,
    ).toBe(false);
    expect(
      updateOfferRequestSchema.safeParse({ ...fields, capacity: 0 }).success,
    ).toBe(false);
  });
});

describe('listOffersQuerySchema', () => {
  it('defaults and coerces', () => {
    expect(listOffersQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(
      listOffersQuerySchema.parse({
        page: '2',
        pageSize: '5',
        status: 'DRAFT',
      }),
    ).toEqual({
      page: 2,
      pageSize: 5,
      status: 'DRAFT',
    });
  });
  it.each([
    { pageSize: '51' },
    { pageSize: '0' },
    { page: '0' },
    { status: 'ACTIVE' },
  ])('rejects %j', (query) => {
    expect(listOffersQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('suspendOfferRequestSchema', () => {
  it('requires a reason', () => {
    expect(
      suspendOfferRequestSchema.parse({ reason: '  Uygunsuz içerik  ' }),
    ).toEqual({ reason: 'Uygunsuz içerik' });
    expect(suspendOfferRequestSchema.safeParse({}).success).toBe(false);
    expect(suspendOfferRequestSchema.safeParse({ reason: '   ' }).success).toBe(
      false,
    );
    expect(
      suspendOfferRequestSchema.safeParse({ reason: 'x'.repeat(501) }).success,
    ).toBe(false);
  });
  it('strips other fields', () => {
    expect(
      suspendOfferRequestSchema.parse({
        reason: 'x',
        status: 'PUBLISHED',
        suspendedById: 'y',
      }),
    ).toEqual({ reason: 'x' });
  });
});

describe('response schemas', () => {
  const row = {
    id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a21',
    ...valid,
    branchId: valid.branchId,
    branch: {
      id: valid.branchId,
      name: 'Kadıköy',
      city: 'İstanbul',
      venueId: 'x',
      address: 'a',
    },
    venue: {
      id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a22',
      name: 'Örnek Kafe',
      ownerId: 'x',
      owner: {
        id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a23',
        name: 'Ayşe',
        email: 'a@b.example',
        passwordHash: '$argon2id$secret',
      },
    },
    status: 'SUSPENDED',
    validFrom: new Date(valid.validFrom),
    validUntil: new Date(valid.validUntil),
    publishedAt: new Date('2026-10-10T10:00:00Z'),
    createdAt: new Date('2026-10-10T09:00:00Z'),
    updatedAt: new Date('2026-10-10T11:00:00Z'),
    suspension: {
      reason: 'Uygunsuz içerik',
      suspendedAt: new Date('2026-10-10T11:00:00Z'),
      suspendedBy: {
        id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a24',
        name: 'Admin',
        email: 'x@y.example',
        passwordHash: '$argon2id$secret',
      },
    },
  };

  it('the owner view shows the suspension reason and time but not the admin', () => {
    const parsed = ownerOfferSchema.parse(row);
    expect(parsed.suspension).toEqual({
      reason: 'Uygunsuz içerik',
      suspendedAt: '2026-10-10T11:00:00.000Z',
    });
    expect(JSON.stringify(parsed)).not.toMatch(
      /Admin|argon2|passwordHash|ownerId|venueId|owner"/,
    );
    expect(parsed.validFrom).toBe(valid.validFrom);
  });

  it('the admin view adds the owner and who suspended it, never a hash', () => {
    const parsed = adminOfferSchema.parse(row);
    expect(parsed.venue.owner.email).toBe('a@b.example');
    expect(parsed.suspension?.suspendedBy).toEqual({
      id: row.suspension.suspendedBy.id,
      name: 'Admin',
    });
    expect(JSON.stringify(parsed)).not.toMatch(
      /argon2|passwordHash|x@y\.example/,
    );
  });

  it('accepts an unsuspended offer', () => {
    expect(
      ownerOfferSchema.parse({
        ...row,
        status: 'DRAFT',
        publishedAt: null,
        suspension: null,
      }).suspension,
    ).toBeNull();
  });
});

describe('idempotency key', () => {
  it.each([
    '0b6c9a52-4c3e-4c0a-9d4e-7a1f2b3c4d5e',
    'a'.repeat(16),
    'A_b-C'.repeat(25) + 'xyz',
  ])('accepts %s', (key) => {
    expect(idempotencyKeySchema.safeParse(key).success).toBe(true);
  });

  it.each([
    '',
    'short',
    'a'.repeat(129),
    'has space in the key 123',
    'weird/chars+in+the+key=1',
    'ünicode-anahtar-0123456789',
    '0b6c9a52-4c3e-4c0a-9d4e-7a1f2b3c4d5e, 0b6c9a52-4c3e-4c0a-9d4e-7a1f2b3c4d5e',
  ])('rejects %j', (key) => {
    expect(idempotencyKeySchema.safeParse(key).success).toBe(false);
  });

  it('has its own 409 code the clients can read', () => {
    expect(
      offerErrorSchema.parse({
        statusCode: 409,
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'x',
      }).code,
    ).toBe('IDEMPOTENCY_KEY_REUSED');
  });
});
