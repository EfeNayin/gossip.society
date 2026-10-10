import { describe, expect, it } from 'vitest';
import {
  buildClearedCookies,
  buildSessionCookies,
  cookieNames,
} from './cookies';

const tokens = {
  accessToken: 'access.jwt.value',
  accessTokenExpiresAt: '2026-10-10T12:15:00.000Z',
  refreshToken: 'refresh-value',
  refreshTokenExpiresAt: '2026-10-17T12:00:00.000Z',
};

describe('session cookies', () => {
  it.each([true, false])(
    'are HttpOnly, Lax and path-wide (secure=%s)',
    (secure) => {
      for (const cookie of buildSessionCookies(tokens, secure)) {
        expect(cookie.httpOnly).toBe(true);
        expect(cookie.sameSite).toBe('lax');
        expect(cookie.path).toBe('/');
        expect(cookie.secure).toBe(secure);
      }
    },
  );

  it('expire exactly when the API says the tokens do, never later', () => {
    const [access, refresh] = buildSessionCookies(tokens, false);
    expect(access!.value).toBe(tokens.accessToken);
    expect(access!.expires.toISOString()).toBe(tokens.accessTokenExpiresAt);
    expect(refresh!.value).toBe(tokens.refreshToken);
    expect(refresh!.expires.toISOString()).toBe(tokens.refreshTokenExpiresAt);
  });

  it('use the __Host- prefix only when Secure', () => {
    expect(cookieNames(true).access.startsWith('__Host-')).toBe(true);
    expect(cookieNames(true).refresh.startsWith('__Host-')).toBe(true);
    expect(cookieNames(false).access.startsWith('__Host-')).toBe(false);
  });

  it('are cleared with matching attributes and an epoch expiry', () => {
    const cleared = buildClearedCookies(true);
    expect(cleared.map((c) => c.name)).toEqual(
      Object.values(cookieNames(true)),
    );
    for (const cookie of cleared) {
      expect(cookie.value).toBe('');
      expect(cookie.expires.getTime()).toBe(0);
      expect(cookie.secure).toBe(true);
      expect(cookie.path).toBe('/');
      expect(cookie.httpOnly).toBe(true);
    }
  });
});
