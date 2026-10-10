import { describe, expect, it } from 'vitest';
import {
  collaborationErrorSchema,
  collaborationStatusSchema,
  createCollaborationRequestSchema,
  listMyCollaborationsQuerySchema,
  listReceivedCollaborationsQuerySchema,
  myCollaborationSchema,
  receivedCollaborationSchema,
} from './collaboration';

const id = '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a11';
const terms = {
  title: 'Akşam yemeği',
  serviceDescription: 'İki kişilik tadım menüsü',
  serviceValueKurus: 250_000,
  expectedContent: 'Bir reels ve üç story',
  minFollowers: 5000,
  validFrom: new Date('2026-11-01T06:00:00Z'),
  validUntil: new Date('2026-12-01T06:00:00Z'),
};
const row = {
  id,
  status: 'APPLIED',
  appliedAt: new Date('2026-10-10T10:00:00Z'),
  decidedAt: null,
  termsAcceptedAt: new Date('2026-10-10T10:00:00Z'),
  terms,
  history: [
    {
      fromStatus: null,
      toStatus: 'APPLIED',
      createdAt: new Date('2026-10-10T10:00:00Z'),
      actorId: 'secret-actor',
    },
  ],
  offer: {
    id,
    title: 'Akşam yemeği',
    venue: { name: 'Kafe', id: 'venue-id', ownerId: 'owner-id' },
    branch: {
      name: 'Kadıköy',
      city: 'İstanbul',
      id: 'branch-id',
      address: 'x',
    },
  },
  applicant: {
    name: 'Ayşe',
    email: 'ayse@example.com',
    passwordHash: 'argon2id$x',
    id: 'user-id',
    profile: {
      city: 'İstanbul',
      bio: 'Yemek',
      instagramUsername: 'ayse',
      id: 'p',
      userId: 'u',
    },
  },
  venueId: 'venue-id',
  influencerId: 'user-id',
};

describe('collaboration schemas', () => {
  it('only the implemented states exist', () => {
    expect(collaborationStatusSchema.options).toEqual([
      'APPLIED',
      'APPROVED',
      'REJECTED',
    ]);
  });

  describe('the application request', () => {
    it('needs the offer and an explicit acceptance of the terms', () => {
      expect(
        createCollaborationRequestSchema.parse({
          offerId: id,
          acceptTerms: true,
        }),
      ).toEqual({
        offerId: id,
        acceptTerms: true,
      });
    });
    it.each([
      [{ offerId: id }],
      [{ offerId: id, acceptTerms: false }],
      [{ offerId: id, acceptTerms: 'true' }],
      [{ offerId: id, acceptTerms: 1 }],
      [{ acceptTerms: true }],
      [{ offerId: 'x', acceptTerms: true }],
    ])('refuses %j', (body) => {
      expect(createCollaborationRequestSchema.safeParse(body).success).toBe(
        false,
      );
    });
    it('drops anything the client adds: status, terms, influencer, venue, times', () => {
      const parsed = createCollaborationRequestSchema.parse({
        offerId: id,
        acceptTerms: true,
        status: 'APPROVED',
        influencerId: 'someone',
        venueId: 'v',
        terms: { serviceValueKurus: 1 },
        termsAcceptedAt: '2020-01-01T00:00:00Z',
        appliedAt: '2020-01-01T00:00:00Z',
      });
      expect(parsed).toEqual({ offerId: id, acceptTerms: true });
    });
  });

  it('the influencer view has the terms and history, and nothing else of the venue or applicant', () => {
    const parsed = myCollaborationSchema.parse(row);
    expect(parsed.terms.validFrom).toBe('2026-11-01T06:00:00.000Z');
    expect(parsed.history).toEqual([
      {
        fromStatus: null,
        toStatus: 'APPLIED',
        createdAt: '2026-10-10T10:00:00.000Z',
      },
    ]);
    expect(JSON.stringify(parsed)).not.toMatch(
      /secret-actor|owner|venue-id|branch-id|argon2|ayse@|influencerId|venueId|address/i,
    );
  });

  it('the owner view shows a basic applicant profile, never an e-mail, hash or id', () => {
    const parsed = receivedCollaborationSchema.parse(row);
    expect(parsed.applicant).toEqual({
      name: 'Ayşe',
      profile: { city: 'İstanbul', bio: 'Yemek', instagramUsername: 'ayse' },
    });
    expect(JSON.stringify(parsed)).not.toMatch(
      /ayse@|argon2|passwordHash|user-id|owner-id|venue-id|secret-actor|followerCount|score|rating/i,
    );
  });

  it('an applicant without a profile is allowed (null), no invented numbers', () => {
    const parsed = receivedCollaborationSchema.parse({
      ...row,
      applicant: { name: 'Ayşe', profile: null },
    });
    expect(parsed.applicant.profile).toBeNull();
  });

  it('the money in the terms is an integer', () => {
    expect(
      myCollaborationSchema.safeParse({
        ...row,
        terms: { ...terms, serviceValueKurus: 19.99 },
      }).success,
    ).toBe(false);
  });

  it('queries: defaults, limits, optional filters', () => {
    expect(listMyCollaborationsQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
    });
    expect(
      listReceivedCollaborationsQuerySchema.parse({
        status: 'APPLIED',
        offerId: id,
        pageSize: '5',
      }),
    ).toEqual({
      page: 1,
      pageSize: 5,
      status: 'APPLIED',
      offerId: id,
    });
    for (const bad of [
      { pageSize: '51' },
      { page: '0' },
      { status: 'CANCELLED' },
      { offerId: 'x' },
    ]) {
      expect(listReceivedCollaborationsQuerySchema.safeParse(bad).success).toBe(
        false,
      );
    }
  });

  it.each([
    'ALREADY_APPLIED',
    'OFFER_NOT_OPEN',
    'NO_ACTIVE_SUBSCRIPTION',
    'OFFER_CAPACITY_FULL',
    'MONTHLY_QUOTA_EXCEEDED',
    'APPLICANT_NOT_ELIGIBLE',
    'COLLABORATION_ALREADY_APPROVED',
    'COLLABORATION_ALREADY_REJECTED',
  ])('knows the 409 code %s', (code) => {
    expect(
      collaborationErrorSchema.parse({ statusCode: 409, code, message: 'x' })
        .code,
    ).toBe(code);
  });
});
