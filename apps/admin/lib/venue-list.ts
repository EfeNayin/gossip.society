// Small helpers for the venue list page.

export const VENUES_PAGE_SIZE = 10;

/** `?page=` as a positive integer; anything else means the first page. */
export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{1,6}$/.test(raw)) return 1;
  const page = Number(raw);
  return page >= 1 ? page : 1;
}

export function venuesHref(page: number): string {
  return page <= 1 ? '/venues' : `/venues?page=${page}`;
}

// Times are stored in UTC and shown in Istanbul time.
const istanbul = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatIstanbul(iso: string): string {
  return istanbul.format(new Date(iso));
}
