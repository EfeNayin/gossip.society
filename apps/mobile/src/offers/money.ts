import { MAX_SERVICE_VALUE_KURUS } from '@gossip/shared';

// Money is an integer number of kuruş everywhere (never a float). The text a
// user types is turned into kuruş by splitting the TEXT into lira and kuruş
// digits: no division, no multiplication of a float, so no rounding error
// (e.g. "19,99" is 1999, not 1998.9999999999998).

export type MoneyParse =
  | { ok: true; kurus: number }
  | {
      ok: false;
      reason: 'empty' | 'format' | 'decimals' | 'zero' | 'too-large';
    };

/**
 * "1250", "1250,5", "1250,50" and "1250.50" are accepted (comma or dot as the
 * decimal separator, at most two decimals, no thousands separators). Anything
 * else is refused, including "1.250" (ambiguous: it has three decimal digits).
 */
export function parseTlToKurus(input: string): MoneyParse {
  const text = input.trim().replace(/\s*₺$/, '').trim();
  if (text === '') return { ok: false, reason: 'empty' };

  const match = /^(\d{1,9})(?:[.,](\d*))?$/.exec(text);
  if (!match) return { ok: false, reason: 'format' };
  const lira = match[1]!;
  const fraction = match[2] ?? '';
  if (fraction.length > 2) return { ok: false, reason: 'decimals' };

  const kurus = Number(lira) * 100 + Number(fraction.padEnd(2, '0'));
  if (kurus < 1) return { ok: false, reason: 'zero' };
  if (kurus > MAX_SERVICE_VALUE_KURUS)
    return { ok: false, reason: 'too-large' };
  return { ok: true, kurus };
}

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** "1.250,50 ₺" (Turkish grouping), done on integers. */
export function formatKurusAsTl(kurus: number): string {
  const lira = Math.floor(kurus / 100);
  const rest = kurus % 100;
  return `${group(String(lira))},${String(rest).padStart(2, '0')} ₺`;
}

/** What goes back into the input when editing: "1250" or "1250,50". */
export function kurusToInput(kurus: number): string {
  const lira = Math.floor(kurus / 100);
  const rest = kurus % 100;
  return rest === 0 ? String(lira) : `${lira},${String(rest).padStart(2, '0')}`;
}
