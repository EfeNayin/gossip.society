import { describe, expect, it } from 'vitest';
import {
  emptyOfferForm,
  offerFieldMessages,
  offerToFormValues,
  parseOfferForm,
  sameFormValues,
  toUpdateRequest,
  type OfferFormValues,
} from './offer-form';

const BRANCH = '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a11';
const valid: OfferFormValues = {
  title: 'Akşam yemeği',
  description: 'İki kişilik akşam yemeği daveti',
  serviceDescription: 'İki kişilik tadım menüsü',
  serviceValueTl: '2500,50',
  expectedContent: 'Bir reels videosu ve üç story',
  minFollowers: '5000',
  capacity: '4',
  validFrom: '01.11.2026 09:00',
  validUntil: '01.12.2026 09:00',
};

describe('parseOfferForm', () => {
  it('builds the API request: integer kuruş, UTC dates, branch', () => {
    expect(parseOfferForm(valid, BRANCH)).toEqual({
      ok: true,
      request: {
        branchId: BRANCH,
        title: 'Akşam yemeği',
        description: 'İki kişilik akşam yemeği daveti',
        serviceDescription: 'İki kişilik tadım menüsü',
        serviceValueKurus: 250_050,
        expectedContent: 'Bir reels videosu ve üç story',
        minFollowers: 5000,
        capacity: 4,
        validFrom: '2026-11-01T06:00:00.000Z',
        validUntil: '2026-12-01T06:00:00.000Z',
      },
    });
  });

  it('trims the texts', () => {
    const result = parseOfferForm({ ...valid, title: '  Başlık  ' }, BRANCH);
    expect(result.ok && result.request.title).toBe('Başlık');
  });

  it('reports every field problem in Turkish at once', () => {
    const result = parseOfferForm(
      {
        title: '  ',
        description: '',
        serviceDescription: 'x'.repeat(301),
        serviceValueTl: '12,345',
        expectedContent: '',
        minFollowers: '-3',
        capacity: '0',
        validFrom: '2026-11-01',
        validUntil: '31.02.2026 09:00',
      },
      undefined,
    );

    expect(result).toEqual({
      ok: false,
      errors: {
        branchId: offerFieldMessages.branch,
        title: offerFieldMessages.required,
        description: offerFieldMessages.required,
        serviceDescription: offerFieldMessages.tooLong(300),
        serviceValueTl: offerFieldMessages.moneyDecimals,
        expectedContent: offerFieldMessages.required,
        minFollowers: offerFieldMessages.wholeNumber,
        capacity: offerFieldMessages.capacity,
        validFrom: offerFieldMessages.dateFormat,
        validUntil: offerFieldMessages.dateInvalid,
      },
    });
  });

  it.each([
    [
      'an empty amount',
      { serviceValueTl: '' },
      'serviceValueTl',
      offerFieldMessages.required,
    ],
    [
      'a zero amount',
      { serviceValueTl: '0' },
      'serviceValueTl',
      offerFieldMessages.moneyZero,
    ],
    [
      'a non-number amount',
      { serviceValueTl: 'çok' },
      'serviceValueTl',
      offerFieldMessages.moneyFormat,
    ],
    [
      'three decimals',
      { serviceValueTl: '1,234' },
      'serviceValueTl',
      offerFieldMessages.moneyDecimals,
    ],
    [
      'too large an amount',
      { serviceValueTl: '1000000,01' },
      'serviceValueTl',
      offerFieldMessages.moneyTooLarge,
    ],
    [
      'zero capacity',
      { capacity: '0' },
      'capacity',
      offerFieldMessages.capacity,
    ],
    [
      'too large a capacity',
      { capacity: '10001' },
      'capacity',
      offerFieldMessages.capacity,
    ],
    [
      'a fractional capacity',
      { capacity: '1,5' },
      'capacity',
      offerFieldMessages.wholeNumber,
    ],
    [
      'too large a follower minimum',
      { minFollowers: '100000001' },
      'minFollowers',
      offerFieldMessages.followers,
    ],
    [
      'a too long title',
      { title: 'x'.repeat(121) },
      'title',
      offerFieldMessages.tooLong(120),
    ],
    [
      'a too long description',
      { description: 'x'.repeat(2001) },
      'description',
      offerFieldMessages.tooLong(2000),
    ],
    [
      'a too long expected content',
      { expectedContent: 'x'.repeat(1001) },
      'expectedContent',
      offerFieldMessages.tooLong(1000),
    ],
    [
      'a missing end date',
      { validUntil: '' },
      'validUntil',
      offerFieldMessages.required,
    ],
    [
      'an end before the start',
      { validUntil: '01.10.2026 09:00' },
      'validUntil',
      offerFieldMessages.range,
    ],
    [
      'an end equal to the start',
      { validUntil: '01.11.2026 09:00' },
      'validUntil',
      offerFieldMessages.range,
    ],
  ])('refuses %s', (_label, override, field, message) => {
    const result = parseOfferForm({ ...valid, ...override }, BRANCH);
    expect(result.ok).toBe(false);
    expect(
      !result.ok && result.errors[field as keyof typeof result.errors],
    ).toBe(message);
  });

  it('accepts the limits exactly', () => {
    const result = parseOfferForm(
      {
        ...valid,
        title: 'x'.repeat(120),
        capacity: '10000',
        minFollowers: '0',
        serviceValueTl: '1000000',
      },
      BRANCH,
    );
    expect(result.ok).toBe(true);
  });

  it('starts empty and not submittable', () => {
    expect(parseOfferForm(emptyOfferForm, undefined).ok).toBe(false);
  });
});

describe('editing an existing offer', () => {
  const offer = {
    id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a21',
    branch: { id: BRANCH, name: 'K', city: 'C' },
    venue: { id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a22', name: 'V' },
    title: 'Akşam yemeği',
    description: 'd',
    serviceDescription: 's',
    serviceValueKurus: 250_050,
    expectedContent: 'e',
    minFollowers: 0,
    capacity: 4,
    validFrom: '2026-11-01T06:00:00.000Z',
    validUntil: '2026-12-01T06:00:00.000Z',
    status: 'DRAFT' as const,
    publishedAt: null,
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
    suspension: null,
  };

  it('shows the stored value as the user would type it (TL, Istanbul time)', () => {
    const values = offerToFormValues(offer);
    expect(values).toMatchObject({
      serviceValueTl: '2500,50',
      validFrom: '01.11.2026 09:00',
      validUntil: '01.12.2026 09:00',
      minFollowers: '0',
      capacity: '4',
    });
  });

  it('round-trips unchanged through the form', () => {
    const result = parseOfferForm(offerToFormValues(offer), offer.branch.id);
    expect(result.ok && result.request).toMatchObject({
      serviceValueKurus: 250_050,
      validFrom: offer.validFrom,
      validUntil: offer.validUntil,
    });
  });

  it('builds the update request without the branch', () => {
    const result = parseOfferForm(valid, BRANCH);
    if (!result.ok) throw new Error('expected a valid form');
    expect(Object.keys(toUpdateRequest(result.request))).not.toContain(
      'branchId',
    );
  });

  it('notices changes, ignoring surrounding spaces', () => {
    const values = offerToFormValues(offer);
    expect(
      sameFormValues(values, { ...values, title: '  ' + values.title + ' ' }),
    ).toBe(true);
    expect(sameFormValues(values, { ...values, capacity: '5' })).toBe(false);
  });
});
