import { describe, expect, it } from 'vitest';
import { offerDisplay } from './offer-state';

const NOW = Date.parse('2026-10-10T12:00:00.000Z');
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

describe('offerDisplay', () => {
  it('shows a draft as Taslak and a suspended offer as Askıya alındı', () => {
    expect(
      offerDisplay(
        { status: 'DRAFT', validFrom: day(1), validUntil: day(9) },
        NOW,
      ),
    ).toEqual({ key: 'draft', label: 'Taslak' });
    expect(
      offerDisplay(
        { status: 'SUSPENDED', validFrom: day(-5), validUntil: day(5) },
        NOW,
      ).label,
    ).toBe('Askıya alındı');
  });

  it('shows a running published offer as Yayında', () => {
    expect(
      offerDisplay(
        { status: 'PUBLISHED', validFrom: day(-1), validUntil: day(5) },
        NOW,
      ),
    ).toEqual({ key: 'published', label: 'Yayında' });
  });

  it('says a published offer with a future start is published but has not started', () => {
    const state = offerDisplay(
      { status: 'PUBLISHED', validFrom: day(3), validUntil: day(30) },
      NOW,
    );
    expect(state.key).toBe('not-started');
    expect(state.label).toContain('Yayında');
    expect(state.label).toContain('henüz başlamadı');
  });

  it('shows a published offer whose validity ended as Süresi doldu (no new backend status)', () => {
    expect(
      offerDisplay(
        { status: 'PUBLISHED', validFrom: day(-10), validUntil: day(-1) },
        NOW,
      ),
    ).toEqual({ key: 'expired', label: 'Süresi doldu' });
  });

  it('treats the end instant itself as expired and the start instant as started', () => {
    expect(
      offerDisplay(
        {
          status: 'PUBLISHED',
          validFrom: day(-1),
          validUntil: new Date(NOW).toISOString(),
        },
        NOW,
      ).key,
    ).toBe('expired');
    expect(
      offerDisplay(
        {
          status: 'PUBLISHED',
          validFrom: new Date(NOW).toISOString(),
          validUntil: day(5),
        },
        NOW,
      ).key,
    ).toBe('published');
  });

  it('does not call a draft or suspended offer expired, whatever its dates', () => {
    expect(
      offerDisplay(
        { status: 'DRAFT', validFrom: day(-10), validUntil: day(-1) },
        NOW,
      ).key,
    ).toBe('draft');
    expect(
      offerDisplay(
        { status: 'SUSPENDED', validFrom: day(-10), validUntil: day(-1) },
        NOW,
      ).key,
    ).toBe('suspended');
  });
});
