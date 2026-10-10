import { describe, expect, it } from 'vitest';
import { MAX_SERVICE_VALUE_KURUS } from '@gossip/shared';
import { formatKurusAsTl, kurusToInput, parseTlToKurus } from './money';

describe('parseTlToKurus', () => {
  it.each([
    ['1250', 125_000],
    ['1250,5', 125_050],
    ['1250,50', 125_050],
    ['1250.50', 125_050],
    ['0,01', 1],
    ['0.99', 99],
    ['  19,99  ', 1999],
    ['19,99 ₺', 1999],
    ['1250,', 125_000],
    ['007', 700],
    ['1000000', 100_000_000],
  ])('turns %j into %i kuruş', (input, kurus) => {
    expect(parseTlToKurus(input)).toEqual({ ok: true, kurus });
  });

  // The classic float traps: none of these may be off by a kuruş.
  it.each([
    ['19,99', 1999],
    ['0,07', 7],
    ['0,29', 29],
    ['1,15', 115],
    ['4,35', 435],
    ['8,20', 820],
    ['35,86', 3586],
    ['1.005'.slice(0, 4), 100], // "1.00" is one lira
  ])('has no float rounding error for %j', (input, kurus) => {
    const result = parseTlToKurus(input);
    expect(result).toEqual({ ok: true, kurus });
    if (result.ok) expect(Number.isInteger(result.kurus)).toBe(true);
  });

  it('always returns an integer', () => {
    for (let kurus = 1; kurus <= 20_000; kurus++) {
      const text = `${Math.floor(kurus / 100)},${String(kurus % 100).padStart(2, '0')}`;
      expect(parseTlToKurus(text)).toEqual({ ok: true, kurus });
    }
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['abc', 'format'],
    ['12,5,3', 'format'],
    ['-5', 'format'],
    ['1e3', 'format'],
    ['1 250', 'format'],
    [',50', 'format'],
    ['1,234', 'decimals'],
    ['1.250', 'decimals'],
    ['0', 'zero'],
    ['0,00', 'zero'],
    ['1000000,01', 'too-large'],
    ['999999999', 'too-large'],
    ['1234567890', 'format'],
  ])('refuses %j (%s)', (input, reason) => {
    expect(parseTlToKurus(input)).toEqual({ ok: false, reason });
  });

  it('accepts exactly the maximum and refuses one kuruş more', () => {
    expect(parseTlToKurus('1000000')).toEqual({
      ok: true,
      kurus: MAX_SERVICE_VALUE_KURUS,
    });
    expect(parseTlToKurus('1000000,01').ok).toBe(false);
  });
});

describe('formatKurusAsTl / kurusToInput', () => {
  it.each([
    [1, '0,01 ₺'],
    [99, '0,99 ₺'],
    [100, '1,00 ₺'],
    [125_050, '1.250,50 ₺'],
    [100_000_000, '1.000.000,00 ₺'],
    [123_456_789, '1.234.567,89 ₺'],
  ])('shows %i kuruş as %s', (kurus, text) => {
    expect(formatKurusAsTl(kurus)).toBe(text);
  });

  it.each([
    [125_000, '1250'],
    [125_050, '1250,50'],
    [1999, '19,99'],
    [1, '0,01'],
  ])('puts %i kuruş back into the input as %s', (kurus, text) => {
    expect(kurusToInput(kurus)).toBe(text);
    expect(parseTlToKurus(kurusToInput(kurus))).toEqual({ ok: true, kurus });
  });
});
