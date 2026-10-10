import { describe, expect, it } from 'vitest';
import { isAccessTokenUsable, readJwtExp } from './jwt-exp';

const jwt = (payload: object) =>
  `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const seconds = (ms: number) => Math.floor(ms / 1000);

describe('readJwtExp', () => {
  it('reads exp', () => {
    expect(readJwtExp(jwt({ exp: 1234 }))).toBe(1234);
  });

  it.each(['', 'abc', 'a.b', 'a.%%%.c', jwt({}), jwt({ exp: 'soon' })])(
    'returns undefined for %j',
    (token) => {
      expect(readJwtExp(token)).toBeUndefined();
    },
  );
});

describe('isAccessTokenUsable', () => {
  it('accepts a token with plenty of time left', () => {
    expect(isAccessTokenUsable(jwt({ exp: seconds(NOW) + 600 }), NOW)).toBe(
      true,
    );
  });

  it('treats a token about to expire as unusable (renew early)', () => {
    expect(isAccessTokenUsable(jwt({ exp: seconds(NOW) + 10 }), NOW)).toBe(
      false,
    );
  });

  it('rejects expired, undecodable and missing tokens', () => {
    expect(isAccessTokenUsable(jwt({ exp: seconds(NOW) - 5 }), NOW)).toBe(
      false,
    );
    expect(isAccessTokenUsable('garbage', NOW)).toBe(false);
    expect(isAccessTokenUsable(undefined, NOW)).toBe(false);
  });
});
