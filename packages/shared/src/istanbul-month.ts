// The monthly match quota counts per calendar month in Europe/Istanbul. Turkey
// has used a fixed UTC+03:00 since 2016 (no daylight saving), so the month
// boundaries are computed from that fixed offset, without Intl or a library
// (the mobile app converts the same way). If the rule ever changes, this is the
// one place to update.
const OFFSET_MS = 3 * 3600 * 1000;

/**
 * The Istanbul calendar month that contains `instant`, as UTC instants:
 * [start, end) where `end` is the start of the next month. Query with
 * `>= start` and `< end`.
 */
export function istanbulMonthRange(instant: Date): { start: Date; end: Date } {
  const local = new Date(instant.getTime() + OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - OFFSET_MS),
    end: new Date(Date.UTC(year, month + 1, 1) - OFFSET_MS),
  };
}
