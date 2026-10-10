import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from './proxy';
import { apiMocks } from './test-support/api-mock';
import { accessJwt } from './test-support/fake-backend';
import { cookieNames } from '@/lib/cookies';
import { getRefreshCoordinator } from '@/lib/refresh-coordinator';

vi.mock('@/lib/api', async (importOriginal) => {
  const { apiMocks } = await import('./test-support/api-mock');
  return { ...(await importOriginal<object>()), ...apiMocks };
});

const { access: AT, refresh: RT } = cookieNames(false);
const tokens = {
  accessToken: accessJwt(900),
  accessTokenExpiresAt: '2026-10-10T12:15:00.000Z',
  refreshToken: 'rt-new',
  refreshTokenExpiresAt: '2026-10-17T12:00:00.000Z',
};

const run = (
  path: string,
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {},
) =>
  proxy(
    new NextRequest(`http://localhost:3001${path}`, {
      headers: {
        ...(Object.keys(cookies).length
          ? {
              cookie: Object.entries(cookies)
                .map(([n, v]) => `${n}=${v}`)
                .join('; '),
            }
          : {}),
        ...headers,
      },
    }),
  );
const forwarded = (res: Response, name: string) =>
  res.headers.get(`x-middleware-request-${name}`);

describe('proxy.ts', () => {
  beforeEach(() => {
    apiMocks.apiRefresh.mockReset();
  });

  it('redirects anonymous visitors to /login and signed-in ones away from it', async () => {
    expect((await run('/')).headers.get('location')).toBe(
      'http://localhost:3001/login',
    );
    expect((await run('/login', { [RT]: 'rt' })).headers.get('location')).toBe(
      'http://localhost:3001/',
    );
    expect((await run('/login')).headers.get('x-middleware-next')).toBe('1');
  });

  it('passes a request with a usable access token without calling the API', async () => {
    const res = await run('/', { [AT]: accessJwt(600), [RT]: 'rt' });
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(apiMocks.apiRefresh).not.toHaveBeenCalled();
  });

  it('renews an expired session: new cookies in the response and in what the page sees', async () => {
    apiMocks.apiRefresh.mockResolvedValue({ kind: 'ok', tokens });

    const res = await run('/', { [RT]: 'rt-old' });

    const setCookies = res.headers.getSetCookie();
    expect(setCookies).toHaveLength(2);
    expect(
      setCookies.every((c) => /httponly/i.test(c) && /samesite=lax/i.test(c)),
    ).toBe(true);
    expect(forwarded(res, 'cookie')).toContain(`${AT}=${tokens.accessToken}`);
    expect(forwarded(res, 'cookie')).toContain(`${RT}=rt-new`);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('removes a client-sent internal auth-state header', async () => {
    const res = await run('/login', {}, { 'x-gs-auth-state': 'unavailable' });
    expect(
      res.headers.get('x-middleware-override-headers') ?? '',
    ).not.toContain('x-gs-auth-state');
    expect(forwarded(res, 'x-gs-auth-state')).toBeNull();
  });

  it('tells the page the API is unavailable and keeps the cookies', async () => {
    apiMocks.apiRefresh.mockResolvedValue({ kind: 'unavailable' });
    const res = await run('/', { [RT]: 'rt' });
    expect(forwarded(res, 'x-gs-auth-state')).toBe('unavailable');
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it.each([
    [
      'refused refresh',
      async () => apiMocks.apiRefresh.mockResolvedValue({ kind: 'rejected' }),
    ],
    ['ended session', async () => getRefreshCoordinator().end('rt')],
  ])(
    'on a %s forwards "none" and touches no cookie (never clears)',
    async (_label, arrange) => {
      await arrange();
      const res = await run('/', { [RT]: 'rt' });
      expect(forwarded(res, 'x-gs-auth-state')).toBe('none');
      expect(res.headers.getSetCookie()).toEqual([]);
    },
  );
});
