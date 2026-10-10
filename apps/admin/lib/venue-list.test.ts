import { describe, expect, it } from 'vitest';
import { formatIstanbul, parsePageParam, venuesHref } from './venue-list';

describe('parsePageParam', () => {
  it.each([
    ['3', 3],
    ['1', 1],
    [['2', '5'], 2],
    [undefined, 1],
    ['0', 1],
    ['-4', 1],
    ['abc', 1],
    ['2.5', 1],
    ['', 1],
    ['9999999999', 1],
    ['1e3', 1],
  ])('reads %j as page %i', (value, expected) => {
    expect(parsePageParam(value)).toBe(expected);
  });
});

describe('venuesHref', () => {
  it('keeps the first page URL clean', () => {
    expect(venuesHref(1)).toBe('/venues');
    expect(venuesHref(3)).toBe('/venues?page=3');
  });
});

describe('formatIstanbul', () => {
  it('shows UTC times in Istanbul time', () => {
    // 21:30 UTC is 00:30 the next day in Istanbul (UTC+3).
    expect(formatIstanbul('2026-10-10T21:30:00.000Z')).toMatch(/11/);
    expect(formatIstanbul('2026-10-10T21:30:00.000Z')).toMatch(/00[.:]30/);
  });
});
