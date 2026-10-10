import { describe, expect, it } from 'vitest';
import { decideProxyAction } from './proxy-decision';

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const jwt = (expOffsetSeconds: number) =>
  `h.${Buffer.from(JSON.stringify({ exp: Math.floor(NOW / 1000) + expOffsetSeconds })).toString('base64url')}.s`;
const fresh = jwt(600);
const expired = jwt(-60);

const decide = (
  pathname: string,
  accessToken?: string,
  refreshToken?: string,
) => decideProxyAction({ pathname, accessToken, refreshToken, nowMs: NOW });

describe('decideProxyAction', () => {
  it('sends anonymous visitors of the panel to /login', () => {
    expect(decide('/')).toEqual({ kind: 'redirect', to: '/login' });
  });

  it('lets anonymous visitors see /login', () => {
    expect(decide('/login')).toEqual({ kind: 'pass' });
  });

  it('passes a request with a usable access token', () => {
    expect(decide('/', fresh, 'rt')).toEqual({ kind: 'pass' });
  });

  it('refreshes when the access cookie is missing or expired and a refresh token exists', () => {
    expect(decide('/', undefined, 'rt')).toEqual({ kind: 'refresh' });
    expect(decide('/', expired, 'rt')).toEqual({ kind: 'refresh' });
  });

  it('does not refresh without a refresh token', () => {
    expect(decide('/', expired)).toEqual({ kind: 'redirect', to: '/login' });
  });

  it('moves signed-in users away from /login', () => {
    expect(decide('/login', fresh, 'rt')).toEqual({
      kind: 'redirect',
      to: '/',
    });
    expect(decide('/login', undefined, 'rt')).toEqual({
      kind: 'redirect',
      to: '/',
    });
  });

  it('treats the session-end page like any protected page', () => {
    expect(decide('/session/end')).toEqual({ kind: 'redirect', to: '/login' });
    expect(decide('/session/end', expired, 'rt')).toEqual({ kind: 'refresh' });
    expect(decide('/session/end', fresh, 'rt')).toEqual({ kind: 'pass' });
  });
});
