import { describe, expect, it } from 'vitest';
import { istanbulMonthRange } from './istanbul-month';

const range = (iso: string) => {
  const { start, end } = istanbulMonthRange(new Date(iso));
  return [start.toISOString(), end.toISOString()];
};

describe('istanbulMonthRange', () => {
  it('a mid-month instant gives that Istanbul month, as UTC boundaries', () => {
    expect(range('2026-10-10T12:00:00Z')).toEqual([
      '2026-09-30T21:00:00.000Z',
      '2026-10-31T21:00:00.000Z',
    ]);
  });

  it('the last millisecond of October in Istanbul is still October', () => {
    expect(range('2026-10-31T20:59:59.999Z')).toEqual([
      '2026-09-30T21:00:00.000Z',
      '2026-10-31T21:00:00.000Z',
    ]);
  });

  it('21:00:00 UTC on the 31st is midnight on the 1st in Istanbul: the next month', () => {
    expect(range('2026-10-31T21:00:00.000Z')).toEqual([
      '2026-10-31T21:00:00.000Z',
      '2026-11-30T21:00:00.000Z',
    ]);
  });

  it('the start is inclusive, the instant just before it belongs to the month before', () => {
    expect(range('2026-09-30T21:00:00.000Z')[0]).toBe(
      '2026-09-30T21:00:00.000Z',
    );
    expect(range('2026-09-30T20:59:59.999Z')).toEqual([
      '2026-08-31T21:00:00.000Z',
      '2026-09-30T21:00:00.000Z',
    ]);
  });

  it('crosses the year', () => {
    expect(range('2026-12-31T21:00:00.000Z')).toEqual([
      '2026-12-31T21:00:00.000Z',
      '2027-01-31T21:00:00.000Z',
    ]);
    expect(range('2026-12-15T00:00:00Z')).toEqual([
      '2026-11-30T21:00:00.000Z',
      '2026-12-31T21:00:00.000Z',
    ]);
  });

  it('handles February in a leap and a non-leap year', () => {
    expect(range('2028-02-10T00:00:00Z')).toEqual([
      '2028-01-31T21:00:00.000Z',
      '2028-02-29T21:00:00.000Z',
    ]);
    expect(range('2027-02-10T00:00:00Z')).toEqual([
      '2027-01-31T21:00:00.000Z',
      '2027-02-28T21:00:00.000Z',
    ]);
  });

  it('the range is always contiguous with its neighbours', () => {
    const a = istanbulMonthRange(new Date('2026-10-10T00:00:00Z'));
    const b = istanbulMonthRange(a.end);
    expect(b.start.getTime()).toBe(a.end.getTime());
  });
});
