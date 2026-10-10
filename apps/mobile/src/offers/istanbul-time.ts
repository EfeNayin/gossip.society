// Dates are stored and sent as UTC; people read and type them as Europe/Istanbul
// time. Türkiye has used a fixed UTC+03:00 (no daylight saving) since 2016, so
// the conversion is a fixed three-hour shift done with plain Date arithmetic.
// That works the same on every device and in tests (no Intl time-zone data
// needed). If the rules ever change, this is the one place to update.
const OFFSET_MS = 3 * 3600 * 1000;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** "01.11.2026 09:00" (Istanbul time) for a UTC ISO string. */
export function formatIstanbul(iso: string): string {
  const d = new Date(Date.parse(iso) + OFFSET_MS);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export const DATE_INPUT_FORMAT = 'GG.AA.YYYY SS:DD';

export type DateParse =
  | { ok: true; iso: string }
  | { ok: false; reason: 'empty' | 'format' | 'invalid' };

/** Parses "GG.AA.YYYY SS:DD" as Istanbul time into a UTC ISO string. */
export function parseIstanbulInput(input: string): DateParse {
  const text = input.trim().replace(/\s+/g, ' ');
  if (text === '') return { ok: false, reason: 'empty' };
  const match = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/.exec(text);
  if (!match) return { ok: false, reason: 'format' };

  const [day, month, year, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  // Build the wall-clock time as if it were UTC, then check it didn't roll over
  // (31.02.2026, 25:00, ...).
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wall);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  ) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, iso: new Date(wall - OFFSET_MS).toISOString() };
}
