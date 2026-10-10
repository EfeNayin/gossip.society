import type { StoredSession } from './types';

const VERSION = 1;

/** One string holding both tokens, so they are always written together. */
export function serializeSession(session: StoredSession): string {
  return JSON.stringify({ v: VERSION, ...session });
}

/** Parses what serializeSession wrote; anything else (corrupt, partial, old format) is null. */
export function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const v = value as Record<string, unknown>;
    if (
      v.v !== VERSION ||
      typeof v.accessToken !== 'string' ||
      v.accessToken === '' ||
      typeof v.refreshToken !== 'string' ||
      v.refreshToken === '' ||
      !Number.isFinite(v.accessExpiresAt) ||
      !Number.isFinite(v.refreshExpiresAt)
    ) {
      return null;
    }
    return {
      accessToken: v.accessToken,
      accessExpiresAt: v.accessExpiresAt as number,
      refreshToken: v.refreshToken,
      refreshExpiresAt: v.refreshExpiresAt as number,
    };
  } catch {
    return null;
  }
}
