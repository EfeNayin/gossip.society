import { describe, expect, it } from 'vitest';
import {
  discoverOfferListSchema,
  discoverOfferSchema,
  discoverOfferSummarySchema,
  discoverQuerySchema,
} from './discover';

const row = {
  id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a11',
  title: 'Akşam yemeği',
  description: 'İki kişilik akşam yemeği daveti',
  serviceDescription: 'İki kişilik tadım menüsü',
  serviceValueKurus: 250_000,
  expectedContent: 'Bir reels ve üç story',
  minFollowers: 5000,
  capacity: 4,
  validFrom: new Date('2026-11-01T06:00:00Z'),
  validUntil: new Date('2026-12-01T06:00:00Z'),
  // Everything below must be stripped.
  status: 'PUBLISHED',
  publishedAt: new Date(),
  suspensionReason: 'x',
  suspendedById: 'admin-id',
  branchId: 'branch-id',
  venue: {
    id: 'venue-id',
    name: 'Kafe',
    ownerId: 'owner-id',
    owner: { email: 'sahip@kafe.example', passwordHash: 'argon2id$x' },
    subscriptions: [{ planId: 'plan' }],
  },
  branch: {
    id: 'branch-id',
    name: 'Kadıköy',
    city: 'İstanbul',
    address: 'Bağdat Cad. 1',
    venueId: 'venue-id',
  },
  subscription: { plan: { activeOfferQuota: 3 } },
};

describe('discover schemas', () => {
  it('the detail has the allowed fields only, with dates as UTC ISO strings', () => {
    const parsed = discoverOfferSchema.parse(row);
    expect(parsed).toEqual({
      id: row.id,
      title: 'Akşam yemeği',
      description: 'İki kişilik akşam yemeği daveti',
      serviceDescription: 'İki kişilik tadım menüsü',
      serviceValueKurus: 250_000,
      expectedContent: 'Bir reels ve üç story',
      minFollowers: 5000,
      capacity: 4,
      validFrom: '2026-11-01T06:00:00.000Z',
      validUntil: '2026-12-01T06:00:00.000Z',
      venue: { name: 'Kafe' },
      branch: { name: 'Kadıköy', city: 'İstanbul', address: 'Bağdat Cad. 1' },
    });
    expect(JSON.stringify(parsed)).not.toMatch(
      /owner|argon2|passwordHash|sahip@|admin|plan|subscription|status|publishedAt|suspen|venue-id|branch-id/i,
    );
  });

  it('the list item is smaller than the detail (no description, capacity, address)', () => {
    const parsed = discoverOfferSummarySchema.parse(row);
    expect(Object.keys(parsed).sort()).toEqual(
      [
        'branch',
        'expectedContent',
        'id',
        'minFollowers',
        'serviceDescription',
        'serviceValueKurus',
        'title',
        'validFrom',
        'validUntil',
        'venue',
      ].sort(),
    );
    expect(parsed.branch).toEqual({ name: 'Kadıköy', city: 'İstanbul' });
  });

  it('has no "places left" field: capacity is the total', () => {
    expect(Object.keys(discoverOfferSchema.parse(row))).not.toContain(
      'remaining',
    );
  });

  it('rejects a money value that is not an integer', () => {
    expect(
      discoverOfferSchema.safeParse({ ...row, serviceValueKurus: 19.99 })
        .success,
    ).toBe(false);
  });

  it('list envelope', () => {
    expect(
      discoverOfferListSchema.parse({
        items: [row],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      }).items[0],
    ).not.toHaveProperty('description');
  });
});

describe('discoverQuerySchema', () => {
  it('defaults and coerces', () => {
    expect(discoverQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(discoverQuerySchema.parse({ page: '3', pageSize: '10' })).toEqual({
      page: 3,
      pageSize: 10,
    });
  });
  it.each([
    { page: '0' },
    { pageSize: '0' },
    { pageSize: '51' },
    { page: 'x' },
  ])('rejects %j', (query) => {
    expect(discoverQuerySchema.safeParse(query).success).toBe(false);
  });
  it('ignores a client-sent status filter', () => {
    expect(discoverQuerySchema.parse({ status: 'DRAFT' })).toEqual({
      page: 1,
      pageSize: 20,
    });
  });
});
