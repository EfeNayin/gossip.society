import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiMocks } from '../../test-support/api-mock';
import { FakeBackend } from '../../test-support/fake-backend';
import { RedirectError, requestContext } from '../../test-support/next-mocks';
import { getRefreshCoordinator } from '@/lib/refresh-coordinator';
import { cookieNames } from '@/lib/cookies';
import { endInvalidSessionAction, loginAction, logoutAction } from './auth';

vi.mock('@/lib/api', async (importOriginal) => {
  const { apiMocks } = await import('../../test-support/api-mock');
  return { ...(await importOriginal<object>()), ...apiMocks };
});

const { access: AT, refresh: RT } = cookieNames(false);
const SAME_ORIGIN = {
  host: 'localhost:3001',
  origin: 'http://localhost:3001',
  'sec-fetch-site': 'same-origin',
};

const forgeries: Array<[string, Record<string, string>]> = [
  ['no Origin header', { host: 'localhost:3001' }],
  [
    'cross-site Origin',
    {
      host: 'localhost:3001',
      origin: 'https://evil.example',
      'sec-fetch-site': 'cross-site',
    },
  ],
  [
    'Origin of another host',
    { host: 'localhost:3001', origin: 'https://evil.example' },
  ],
  [
    'cross-site fetch metadata with a matching Origin',
    { ...SAME_ORIGIN, 'sec-fetch-site': 'cross-site' },
  ],
];

async function redirectTarget(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof RedirectError) return error.url;
    throw error;
  }
  return undefined;
}

describe('Server Actions', () => {
  let backend: FakeBackend;
  let login: ReturnType<FakeBackend['login']>;

  beforeEach(() => {
    backend = new FakeBackend().install();
    login = backend.login();
  });

  // The request as it reaches the action: the browser's cookies + headers.
  function request(
    headers: Record<string, string>,
    cookies: Record<string, string> = {
      [AT]: login.accessToken,
      [RT]: login.refreshToken,
    },
  ) {
    requestContext.headers = new Headers(headers);
    for (const [name, value] of Object.entries(cookies)) {
      requestContext.cookies.set(name, value);
    }
  }

  describe('POST logout (CSRF)', () => {
    it.each(forgeries)('does nothing for %s', async (_label, headers) => {
      request(headers);

      expect(await redirectTarget(logoutAction)).toBe('/');

      expect(apiMocks.apiLogout).not.toHaveBeenCalled();
      expect(requestContext.outgoing).toEqual([]);
      expect(getRefreshCoordinator().isEnded(login.refreshToken)).toBe(false);
      expect(backend.sessions[0]!.revoked).toBe(false);
    });

    it('ends the session for a same-origin POST', async () => {
      request(SAME_ORIGIN);

      expect(await redirectTarget(logoutAction)).toBe('/login?reason=logout');

      expect(apiMocks.apiLogout).toHaveBeenCalledWith(login.accessToken);
      expect(backend.sessions[0]!.revoked).toBe(true);
      expect(requestContext.outgoing.map((c) => c.name).sort()).toEqual(
        [AT, RT].sort(),
      );
      expect(
        requestContext.outgoing.every(
          (c) => c.value === '' && c.expires.getTime() === 0,
        ),
      ).toBe(true);
      expect(getRefreshCoordinator().isEnded(login.refreshToken)).toBe(true);
    });

    it('is honest when the API cannot be reached: cookies cleared, session not revoked', async () => {
      apiMocks.apiLogout.mockResolvedValue({ kind: 'unreachable' });
      request(SAME_ORIGIN);

      expect(await redirectTarget(logoutAction)).toBe(
        '/login?reason=logout-local',
      );

      expect(requestContext.outgoing).toHaveLength(2);
      expect(backend.sessions[0]!.revoked).toBe(false);
    });
  });

  describe('POST end-session (CSRF)', () => {
    // A session that really is unusable: revoked on the server.
    beforeEach(() => {
      backend.sessions[0]!.revoked = true;
    });

    it.each(forgeries)('does nothing for %s', async (_label, headers) => {
      request(headers);

      expect(await redirectTarget(endInvalidSessionAction)).toBe('/');

      expect(apiMocks.apiLogout).not.toHaveBeenCalled();
      expect(requestContext.outgoing).toEqual([]);
      expect(getRefreshCoordinator().isEnded(login.refreshToken)).toBe(false);
    });

    it('clears cookies and revokes for a same-origin POST', async () => {
      request(SAME_ORIGIN);

      expect(await redirectTarget(endInvalidSessionAction)).toBe(
        '/login?reason=expired',
      );

      expect(requestContext.outgoing).toHaveLength(2);
      expect(requestContext.outgoing.every((c) => c.value === '')).toBe(true);
      expect(apiMocks.apiLogout).toHaveBeenCalled();
      expect(getRefreshCoordinator().isEnded(login.refreshToken)).toBe(true);
    });

    it('revokes the live server session of an account that may not use the panel', async () => {
      const owner = backend.login({
        id: 'ac1d4d10-0000-4000-8000-000000000001',
        email: 'owner@gossip-society.example',
        name: 'Owner',
        role: 'VENUE_OWNER',
        status: 'ACTIVE',
      });
      request(SAME_ORIGIN, {
        [AT]: owner.accessToken,
        [RT]: owner.refreshToken,
      });

      expect(await redirectTarget(endInvalidSessionAction)).toBe(
        '/login?reason=forbidden',
      );

      expect(owner.session.revoked).toBe(true);
      expect(requestContext.outgoing).toHaveLength(2);
    });

    it('does not sign out a valid admin', async () => {
      backend.sessions[0]!.revoked = false;
      request(SAME_ORIGIN);

      expect(await redirectTarget(endInvalidSessionAction)).toBe('/');

      expect(requestContext.outgoing).toEqual([]);
      expect(apiMocks.apiLogout).not.toHaveBeenCalled();
      expect(backend.sessions[0]!.revoked).toBe(false);
    });

    it('does not end a session while the API is down', async () => {
      apiMocks.apiMe.mockResolvedValue({ kind: 'unreachable' });
      request(SAME_ORIGIN);

      expect(await redirectTarget(endInvalidSessionAction)).toBe('/');

      expect(requestContext.outgoing).toEqual([]);
      expect(apiMocks.apiLogout).not.toHaveBeenCalled();
    });
  });

  describe('POST login (CSRF)', () => {
    it.each(forgeries)('is refused for %s', async (_label, headers) => {
      request(headers, {});
      const form = new FormData();
      form.set('email', 'admin@gossip-society.example');
      form.set('password', 'pw');

      const state = await loginAction({}, form);

      expect(state.error).toBeDefined();
      expect(apiMocks.apiLogin).not.toHaveBeenCalled();
      expect(requestContext.outgoing).toEqual([]);
    });

    it('sets the session cookies only for a same-origin ADMIN login', async () => {
      request(SAME_ORIGIN, {});
      const form = new FormData();
      form.set('email', 'admin@gossip-society.example');
      form.set('password', 'pw');

      expect(await redirectTarget(() => loginAction({}, form))).toBe('/');

      expect(requestContext.outgoing.map((c) => c.name).sort()).toEqual(
        [AT, RT].sort(),
      );
      expect(
        requestContext.outgoing.every(
          (c) => c.httpOnly && c.sameSite === 'lax',
        ),
      ).toBe(true);
    });
  });
});
