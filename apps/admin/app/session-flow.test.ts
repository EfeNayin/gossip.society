import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBrowser, AT, RT } from '../test-support/browser';
import { FakeBackend } from '../test-support/fake-backend';
import { apiMocks } from '../test-support/api-mock';
import { requestContext } from '../test-support/next-mocks';

vi.mock('@/lib/api', async (importOriginal) => {
  const { apiMocks } = await import('../test-support/api-mock');
  return { ...(await importOriginal<object>()), ...apiMocks };
});

// Next.js bundles proxy.ts and the Server Actions separately: they get their
// own copies of every module (checked on a production build). Load them from
// two separate module registries so these tests have the same split. State
// shared between them can then only travel the way it does in production:
// through globalThis.
async function loadServer() {
  vi.resetModules();
  const { proxy } = await import('../proxy');
  vi.resetModules();
  const actions = await import('./actions/auth');
  const sessionEnd = await import('./session/end/session-end');
  const dal = await import('@/lib/session');
  const coordinators = await import('@/lib/refresh-coordinator');
  return { proxy, actions, sessionEnd, dal, coordinators };
}

describe('proxy + Server Actions together', () => {
  let backend: FakeBackend;
  let server: Awaited<ReturnType<typeof loadServer>>;
  let browser: FakeBrowser;

  beforeEach(async () => {
    backend = new FakeBackend().install();
    server = await loadServer();
    browser = new FakeBrowser(server.proxy);
  });

  // Signs in through the real login action and returns what the browser holds.
  async function signIn() {
    await browser.send({
      method: 'POST',
      path: '/login',
      handler: () => {
        const form = new FormData();
        form.set('email', 'admin@gossip-society.example');
        form.set('password', 'pw');
        return server.actions.loginAction({}, form);
      },
    });
    return { at: browser.jar.get(AT)!, rt: browser.jar.get(RT)! };
  }

  const logout = () =>
    browser.send({ method: 'POST', handler: server.actions.logoutAction });

  it('shares one coordinator between the separately loaded proxy and actions', async () => {
    const other = await loadServer();
    expect(other.coordinators.getRefreshCoordinator()).toBe(
      server.coordinators.getRefreshCoordinator(),
    );
  });

  describe('successful refresh -> logout -> late request with the old token', () => {
    it('keeps the backend session revoked and writes no cookies again', async () => {
      const first = await signIn();
      // The access cookie is gone (expired): the proxy renews the session.
      browser.jar.delete(AT);
      const renewed = await browser.send({});
      expect(renewed.proxySetCookies).toHaveLength(2);
      const second = { at: browser.jar.get(AT)!, rt: browser.jar.get(RT)! };
      expect(second.rt).not.toBe(first.rt);
      expect(backend.calls.refresh).toBe(1);

      // Logout with the renewed cookies.
      const out = await logout();
      expect(out.redirectedTo).toBe('/login?reason=logout');
      expect(browser.jar.size).toBe(0);
      expect(backend.sessions[0]!.revoked).toBe(true);
      expect(backend.calls.logout).toBe(1);

      // Another tab's request that left the browser before the renewal still
      // carries the OLD refresh token, and arrives inside the grace window.
      const late = await browser.send({ cookies: { [RT]: first.rt } });

      // Browser cookies were not rebuilt from the cached refresh result...
      expect(late.proxySetCookies).toEqual([]);
      expect(browser.jar.size).toBe(0);
      expect(late.authState).toBe('none');
      // ...and the backend was not asked again, so its session stays revoked.
      expect(backend.calls.refresh).toBe(1);
      expect(backend.sessions[0]!.revoked).toBe(true);
    });
  });

  describe('logout while a refresh is in flight', () => {
    it('does not let the refresh result write cookies; the backend stays revoked', async () => {
      const { at, rt } = await signIn();
      browser.jar.delete(AT); // access cookie expired: the next request refreshes
      const release = backend.holdRefreshes();

      // A request carrying only the refresh cookie: the proxy asks the API and
      // waits for the answer.
      const stale = browser.send({ cookies: { [RT]: rt } });
      await vi.waitFor(() => expect(backend.calls.refresh).toBe(1));

      // Meanwhile a logout request that still has a usable access token.
      browser.jar.set(AT, at);
      const out = await browser.send({
        method: 'POST',
        handler: server.actions.logoutAction,
      });
      expect(out.redirectedTo).toBe('/login?reason=logout');
      expect(browser.jar.size).toBe(0);

      // Now the in-flight refresh finishes.
      release();
      const result = await stale;

      expect(result.proxySetCookies).toEqual([]);
      expect(result.authState).toBe('none');
      expect(browser.jar.size).toBe(0);
      // Backend: the API had already rotated the token before the logout
      // arrived; the logout then revoked the session, new tokens included.
      expect(backend.sessions[0]!.revoked).toBe(true);
    });

    it('also holds when the refresh is answered after the logout request finished', async () => {
      const { rt } = await signIn();
      browser.jar.delete(AT);
      const release = backend.holdRefreshes();
      const stale = browser.send({ cookies: { [RT]: rt } });
      await vi.waitFor(() => expect(backend.calls.refresh).toBe(1));

      // The logout can only use the cookies the browser has; it ends the
      // session for this process by the refresh token alone.
      server.coordinators.getRefreshCoordinator().end(rt);
      release();

      expect((await stale).proxySetCookies).toEqual([]);
    });
  });

  describe('signing in again after a logout', () => {
    it('is not overwritten by the answer to an old, still running refresh', async () => {
      const first = await signIn();
      browser.jar.delete(AT);
      const release = backend.holdRefreshes();
      const stale = browser.send({ cookies: { [RT]: first.rt } });
      await vi.waitFor(() => expect(backend.calls.refresh).toBe(1));

      // The user logs out (access cookie present again) and signs in again.
      browser.jar.set(AT, first.at);
      await browser.send({
        method: 'POST',
        handler: server.actions.logoutAction,
      });
      const again = await signIn();
      expect(again.rt).not.toBe(first.rt);
      const jarAfterLogin = new Map(browser.jar);

      // The old refresh now completes.
      release();
      const result = await stale;

      expect(result.proxySetCookies).toEqual([]);
      expect(browser.jar).toEqual(jarAfterLogin);
      expect(browser.jar.get(RT)).toBe(again.rt);
      // Old session revoked, new session alive.
      expect(backend.sessions[0]!.revoked).toBe(true);
      expect(backend.sessions[1]!.revoked).toBe(false);
    });

    it('treats the new login as a separate session that can refresh normally', async () => {
      await signIn();
      await logout();
      const again = await signIn();
      browser.jar.delete(AT);

      const renewed = await browser.send({});

      expect(renewed.proxySetCookies).toHaveLength(2);
      expect(browser.jar.get(RT)).not.toBe(again.rt);
      expect(backend.sessions[1]!.revoked).toBe(false);
    });
  });

  describe('a refresh the API refuses', () => {
    it('does not clear cookies in the proxy (it could delete a newer login)', async () => {
      const { rt } = await signIn();
      backend.sessions[0]!.revoked = true;
      browser.jar.delete(AT);

      const res = await browser.send({ cookies: { [RT]: rt } });

      expect(res.proxySetCookies).toEqual([]);
      expect(res.authState).toBe('none');
    });
  });

  describe('invalid session -> end-session step -> login (no redirect loop)', () => {
    it('ends in /login with the cookies gone and stays there', async () => {
      await signIn();
      backend.sessions[0]!.revoked = true; // revoked elsewhere
      browser.jar.delete(AT);

      // Visiting the panel with only a dead refresh cookie: proxy refuses it...
      const page = await browser.send({ path: '/' });
      expect(page.authState).toBe('none');
      expect(page.proxySetCookies).toEqual([]);
      expect(requestContext.cookies.get(RT)).toBeDefined();

      // ...the end-session page (a GET) shows the form and changes nothing...
      const cookiesBefore = new Map(browser.jar);
      const logoutCallsBefore = backend.calls.logout;
      const get = await browser.send({
        path: '/session/end',
        handler: async () => {
          await server.sessionEnd.SessionEnd();
        },
      });
      expect(get.redirectedTo).toBeUndefined();
      expect(browser.jar).toEqual(cookiesBefore);
      expect(backend.calls.logout).toBe(logoutCallsBefore);

      // ...its POST clears the cookies and goes to the login page...
      const post = await browser.send({
        method: 'POST',
        path: '/session/end',
        handler: server.actions.endInvalidSessionAction,
      });
      expect(post.redirectedTo).toBe('/login?reason=expired');
      expect(browser.jar.size).toBe(0);

      // ...where the proxy lets the visitor stay.
      const login = await browser.send({ path: '/login?reason=expired' });
      expect(login.proxy.headers.get('location')).toBeNull();
      expect(login.redirectedTo).toBeUndefined();
    });

    it('a valid admin who opens the end-session page is sent back to the panel', async () => {
      await signIn();
      const jar = new Map(browser.jar);

      const get = await browser.send({
        path: '/session/end',
        handler: async () => {
          await server.sessionEnd.SessionEnd();
        },
      });
      expect(get.redirectedTo).toBe('/');

      const post = await browser.send({
        method: 'POST',
        path: '/session/end',
        handler: server.actions.endInvalidSessionAction,
      });
      expect(post.redirectedTo).toBe('/');
      expect(browser.jar).toEqual(jar); // not signed out
      expect(backend.sessions[0]!.revoked).toBe(false);
      expect(apiMocks.apiLogout).not.toHaveBeenCalled();
    });
  });
});
