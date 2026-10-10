import { describe, expect, it } from 'vitest';
import { formatIstanbul, parseIstanbulInput } from './istanbul-time';

describe('parseIstanbulInput', () => {
  it('reads Istanbul time and returns UTC (three hours earlier)', () => {
    expect(parseIstanbulInput('01.11.2026 09:00')).toEqual({
      ok: true,
      iso: '2026-11-01T06:00:00.000Z',
    });
    expect(parseIstanbulInput('15.07.2026 23:30')).toEqual({
      ok: true,
      iso: '2026-07-15T20:30:00.000Z',
    });
  });

  it('crosses midnight and year boundaries correctly', () => {
    expect(parseIstanbulInput('01.01.2027 01:30')).toEqual({
      ok: true,
      iso: '2026-12-31T22:30:00.000Z',
    });
    expect(parseIstanbulInput('01.03.2028 00:00')).toEqual({
      ok: true,
      iso: '2028-02-29T21:00:00.000Z',
    }); // leap year
  });

  it('is the same in winter and summer (no daylight saving)', () => {
    expect(parseIstanbulInput('01.01.2026 12:00')).toEqual({
      ok: true,
      iso: '2026-01-01T09:00:00.000Z',
    });
    expect(parseIstanbulInput('01.07.2026 12:00')).toEqual({
      ok: true,
      iso: '2026-07-01T09:00:00.000Z',
    });
  });

  it('tolerates extra spaces', () => {
    expect(parseIstanbulInput('  01.11.2026   09:00 ').ok).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['1.11.2026 09:00', 'format'],
    ['01/11/2026 09:00', 'format'],
    ['01.11.2026', 'format'],
    ['2026-11-01 09:00', 'format'],
    ['01.11.2026 9:00', 'format'],
    ['31.02.2026 09:00', 'invalid'],
    ['29.02.2027 09:00', 'invalid'],
    ['01.13.2026 09:00', 'invalid'],
    ['00.11.2026 09:00', 'invalid'],
    ['01.11.2026 24:00', 'invalid'],
    ['01.11.2026 09:60', 'invalid'],
  ])('refuses %j (%s)', (input, reason) => {
    expect(parseIstanbulInput(input)).toEqual({ ok: false, reason });
  });
});

describe('formatIstanbul', () => {
  it('shows UTC instants as Istanbul time', () => {
    expect(formatIstanbul('2026-11-01T06:00:00.000Z')).toBe('01.11.2026 09:00');
    expect(formatIstanbul('2026-12-31T22:30:00.000Z')).toBe('01.01.2027 01:30');
  });

  it('round-trips with the parser', () => {
    for (const text of [
      '01.11.2026 09:00',
      '31.12.2026 23:59',
      '29.02.2028 00:00',
    ]) {
      const parsed = parseIstanbulInput(text);
      expect(parsed.ok && formatIstanbul(parsed.iso)).toBe(text);
    }
  });
});
