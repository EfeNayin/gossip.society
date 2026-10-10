import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { messages, noticeMessages } from './messages';
import { SessionManager } from './session-manager';
import {
  ACCESS_TTL_MS,
  Clock,
  FakeApi,
  MemoryStorage,
  user,
} from './test-support';
import type { SafeUser } from '@gossip/shared';

const PASSWORD = 'correct horse battery';

function setup(initial: ConstructorParameters<typeof MemoryStorage>[0] = null) {
  const clock = new Clock();
  const api = new FakeApi(clock);
  const storage = new MemoryStorage(initial);
  const manager = new SessionManager({ api, storage, now: clock.now });
  const accounts = {
    influencer: user('INFLUENCER'),
    owner: user('VENUE_OWNER'),
    staff: user('VENUE_STAFF'),
    admin: user('ADMIN'),
  };
  for (const account of Object.values(accounts))
    api.addAccount(PASSWORD, account);
  return { clock, api, storage, manager, accounts };
}
type Ctx = ReturnType<typeof setup>;

const creds = (account: SafeUser, password = PASSWORD) => ({
  email: account.email,
  password,
});
const signIn = async (
  ctx: Ctx,
  account: SafeUser = ctx.accounts.influencer,
) => {
  const result = await ctx.manager.login(creds(account));
  expect(result).toEqual({ kind: 'ok' });
};
const snap = (ctx: Ctx) => ctx.manager.getSnapshot();
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// No token may ever reach the console.
const consoleSpies = ['log', 'info', 'warn', 'error', 'debug'].map((m) =>
  vi.spyOn(console, m as 'log').mockImplementation(() => {}),
);
afterEach(() => {
  for (const spy of consoleSpies) {
    for (const call of spy.mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(/\b(at|rt)-\d+/);
    }
    spy.mockClear();
  }
});

describe('SessionManager: login', () => {
  it.each([
    ['INFLUENCER', 'influencer'],
    ['VENUE_OWNER', 'owner'],
    ['VENUE_STAFF', 'staff'],
  ] as const)(
    'signs in an ACTIVE %s and keeps both tokens in ONE secure write',
    async (role, key) => {
      const ctx = setup();

      await signIn(ctx, ctx.accounts[key]);

      expect(snap(ctx)).toMatchObject({
        status: 'signedIn',
        notice: null,
        user: { role },
      });
      expect(ctx.storage.log).toEqual(['save']);
      expect(ctx.storage.value).toMatchObject({
        accessToken: expect.stringMatching(/^at-/),
        refreshToken: expect.stringMatching(/^rt-/),
      });
    },
  );

  it('refuses an ADMIN on mobile: revokes the new session and stores nothing', async () => {
    const ctx = setup();

    const result = await ctx.manager.login(creds(ctx.accounts.admin));

    expect(result).toEqual({ kind: 'admin-web' });
    expect(snap(ctx)).toMatchObject({
      status: 'signedOut',
      user: null,
      notice: 'admin-web',
    });
    expect(noticeMessages['admin-web']).toBe(messages.adminWeb);
    expect(ctx.storage.log).toEqual([]);
    expect(ctx.api.calls.logout).toBe(1);
    expect(ctx.api.sessions[0]!.revoked).toBe(true);
  });

  it.each([
    [
      'a wrong password',
      () => ({ password: 'nope' }),
      messages.invalidCredentials,
    ],
    [
      'an unknown e-mail',
      () => ({ email: 'nobody@gossip-society.example' }),
      messages.invalidCredentials,
    ],
    [
      'a malformed e-mail',
      () => ({ email: 'not-an-email' }),
      messages.invalidForm,
    ],
    ['an empty password', () => ({ password: '' }), messages.invalidForm],
  ])('shows the Turkish message for %s', async (_label, override, message) => {
    const ctx = setup();
    await ctx.manager.start(); // the app always starts first: signed out

    const result = await ctx.manager.login({
      ...creds(ctx.accounts.influencer),
      ...override(),
    });

    expect(result).toEqual({ kind: 'error', message });
    expect(snap(ctx).status).toBe('signedOut');
    expect(ctx.storage.log).toEqual([]);
  });

  it.each([
    ['PENDING', messages.accountPending],
    ['SUSPENDED', messages.accountSuspended],
  ] as const)(
    'tells a %s account apart and gives it no session',
    async (status, message) => {
      const ctx = setup();
      const account = user('INFLUENCER', {
        status,
        email: 'other@gossip-society.example',
      });
      ctx.api.addAccount(PASSWORD, account);

      const result = await ctx.manager.login(creds(account));

      expect(result).toEqual({ kind: 'error', message });
      expect(ctx.storage.log).toEqual([]);
      expect(snap(ctx).user).toBeNull();
    },
  );

  it.each([
    [
      'rate limiting',
      { kind: 'error', status: 429 } as const,
      messages.rateLimited,
    ],
    [
      'an unreachable API',
      { kind: 'unreachable' } as const,
      messages.unreachable,
    ],
    [
      'a server error',
      { kind: 'error', status: 500 } as const,
      messages.unexpected,
    ],
  ])('shows the message for %s', async (_label, forced, message) => {
    const ctx = setup();
    ctx.api.forced.login = forced;

    expect(await ctx.manager.login(creds(ctx.accounts.influencer))).toEqual({
      kind: 'error',
      message,
    });
    expect(ctx.storage.log).toEqual([]);
  });

  it('ignores a second tap while a sign-in is running (one request, one result)', async () => {
    const ctx = setup();
    ctx.api.gates.login.hold();

    const first = ctx.manager.login(creds(ctx.accounts.influencer));
    const second = ctx.manager.login(creds(ctx.accounts.influencer));
    ctx.api.gates.login.open();

    expect(await first).toEqual({ kind: 'ok' });
    expect(await second).toEqual({ kind: 'ok' });
    expect(ctx.api.calls.login).toBe(1);
    expect(ctx.api.sessions).toHaveLength(1);
  });
});

describe('SessionManager: reopening the app', () => {
  async function storedSession(ctx: Ctx, account = ctx.accounts.influencer) {
    await signIn(ctx, account);
    return { ...ctx.storage.value! };
  }

  it('shows signed out when nothing is stored', async () => {
    const ctx = setup();
    await ctx.manager.start();
    expect(snap(ctx).status).toBe('signedOut');
    expect(ctx.api.calls.me).toBe(0);
  });

  it('validates a stored session with the API and takes the role from its answer', async () => {
    const first = setup();
    const stored = await storedSession(first);
    const ctx = setup(stored);
    ctx.api.sessions = first.api.sessions; // same server

    await ctx.manager.start();

    expect(snap(ctx)).toMatchObject({
      status: 'signedIn',
      user: { role: 'INFLUENCER' },
    });
    expect(ctx.api.calls.me).toBe(1);
    expect(ctx.api.calls.refresh).toBe(0);
  });

  it('renews an expired access token once and keeps the new pair', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    const reopened = new SessionManager({
      api: ctx.api,
      storage: ctx.storage,
      now: ctx.clock.now,
    });

    await reopened.start();

    expect(reopened.getSnapshot().status).toBe('signedIn');
    expect(ctx.api.calls.refresh).toBe(1);
    expect(ctx.storage.value!.refreshToken).toBe(
      ctx.api.sessions[0]!.refreshToken,
    );
    expect(ctx.api.sessions[0]!.usedRefreshTokens.size).toBe(1);
  });

  it('drops a session whose refresh token expired, without calling the API', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.clock.advance(8 * 24 * 3600_000);
    const reopened = new SessionManager({
      api: ctx.api,
      storage: ctx.storage,
      now: ctx.clock.now,
    });

    await reopened.start();

    expect(reopened.getSnapshot().status).toBe('signedOut');
    expect(ctx.storage.value).toBeNull();
    expect(ctx.api.calls.refresh).toBe(0);
    expect(ctx.api.calls.me).toBe(0);
  });

  it('clears a session the server has revoked, with exactly one refresh attempt', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.api.sessions[0]!.revoked = true;
    const reopened = new SessionManager({
      api: ctx.api,
      storage: ctx.storage,
      now: ctx.clock.now,
    });

    await reopened.start();

    expect(reopened.getSnapshot()).toMatchObject({
      status: 'signedOut',
      notice: 'expired',
    });
    expect(ctx.storage.value).toBeNull();
    expect(ctx.api.calls.me).toBe(1);
    expect(ctx.api.calls.refresh).toBe(1);
  });

  it('does not loop: a fresh token that is refused too ends the session after one renewal', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.api.forced.me = { kind: 'error', status: 401 };
    const reopened = new SessionManager({
      api: ctx.api,
      storage: ctx.storage,
      now: ctx.clock.now,
    });

    await reopened.start();

    expect(reopened.getSnapshot().status).toBe('signedOut');
    expect(ctx.api.calls.refresh).toBe(1);
    expect(ctx.api.calls.me).toBe(2); // the original call and ONE retry
  });

  it.each([
    ['unreachable', { kind: 'unreachable' } as const],
    ['a 500', { kind: 'error', status: 500 } as const],
    ['a 429', { kind: 'error', status: 429 } as const],
  ])(
    'keeps the session and offers a retry when the refresh meets %s',
    async (_label, forced) => {
      const ctx = setup();
      await signIn(ctx);
      const kept = { ...ctx.storage.value! };
      ctx.clock.advance(ACCESS_TTL_MS + 1000);
      ctx.api.forced.refresh = forced;
      const reopened = new SessionManager({
        api: ctx.api,
        storage: ctx.storage,
        now: ctx.clock.now,
      });

      await reopened.start();

      expect(reopened.getSnapshot().status).toBe('unavailable');
      expect(ctx.storage.value).toEqual(kept); // not deleted
      expect(ctx.storage.log).toEqual(['save']); // nothing cleared

      // Back online: retry works.
      ctx.api.forced.refresh = undefined;
      await reopened.validate({ force: true });
      expect(reopened.getSnapshot().status).toBe('signedIn');
    },
  );

  it('keeps the session while the API is down (offline start)', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.api.forced.me = { kind: 'unreachable' };
    const reopened = new SessionManager({
      api: ctx.api,
      storage: ctx.storage,
      now: ctx.clock.now,
    });

    await reopened.start();

    expect(reopened.getSnapshot().status).toBe('unavailable');
    expect(ctx.storage.value).not.toBeNull();
  });

  it('ends the session when the account is no longer ACTIVE', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.api.forced.me = {
      kind: 'error',
      status: 403,
      code: 'ACCOUNT_SUSPENDED',
    };
    const reopened = new SessionManager({
      api: ctx.api,
      storage: ctx.storage,
      now: ctx.clock.now,
    });

    await reopened.start();

    expect(reopened.getSnapshot()).toMatchObject({
      status: 'signedOut',
      notice: 'inactive',
    });
    expect(ctx.storage.value).toBeNull();
  });

  it('revokes and clears a stored session whose user has become an ADMIN', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.api.sessions[0]!.user = ctx.accounts.admin; // role changed on the server
    const reopened = new SessionManager({
      api: ctx.api,
      storage: ctx.storage,
      now: ctx.clock.now,
    });

    await reopened.start();

    expect(reopened.getSnapshot()).toMatchObject({
      status: 'signedOut',
      notice: 'admin-web',
    });
    expect(ctx.storage.value).toBeNull();
    expect(ctx.api.sessions[0]!.revoked).toBe(true);
  });

  it('re-checks when the app returns to the foreground, but not on every event', async () => {
    const ctx = setup();
    await signIn(ctx);
    await ctx.manager.validate(); // just signed in: skipped
    expect(ctx.api.calls.me).toBe(0);

    ctx.clock.advance(60_000);
    await ctx.manager.validate();
    expect(ctx.api.calls.me).toBe(1);

    await ctx.manager.validate(); // immediately again: skipped
    expect(ctx.api.calls.me).toBe(1);
  });

  it('turns a foreground check into the retry state when the session is revoked', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.clock.advance(60_000);
    ctx.api.sessions[0]!.revoked = true;

    await ctx.manager.validate();

    expect(snap(ctx)).toMatchObject({ status: 'signedOut', notice: 'expired' });
    expect(ctx.storage.value).toBeNull();
  });
});

describe('SessionManager: renewing tokens', () => {
  it('runs one refresh for many simultaneous requests (single-flight)', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    ctx.api.gates.refresh.hold();
    const seen: string[] = [];

    const calls = Array.from({ length: 6 }, () =>
      ctx.manager.request(async (token) => {
        seen.push(token);
        return ctx.api.me(token);
      }),
    );
    await flush();
    ctx.api.gates.refresh.open();
    const results = await Promise.all(calls);

    expect(results.every((r) => r.kind === 'ok')).toBe(true);
    expect(ctx.api.calls.refresh).toBe(1);
    expect(new Set(seen).size).toBe(1); // every call used the one renewed token
    expect(ctx.storage.log.filter((e) => e === 'save')).toHaveLength(2); // login + ONE renewal
  });

  it('shares one refresh between a validation and a request', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    ctx.api.gates.refresh.hold();

    const a = ctx.manager.validate({ force: true });
    const b = ctx.manager.request((token) => ctx.api.me(token));
    await flush();
    ctx.api.gates.refresh.open();
    await Promise.all([a, b]);

    expect(ctx.api.calls.refresh).toBe(1);
  });

  it('retries a 401 exactly once, with one renewal, even when several calls get it at once', async () => {
    const ctx = setup();
    await signIn(ctx);
    // The server rejects the first access token although the clock says it is valid.
    const first = ctx.storage.value!.accessToken;
    ctx.api.sessions[0]!.accessTokens.delete(first);

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        ctx.manager.request((token) => ctx.api.me(token)),
      ),
    );

    expect(results.every((r) => r.kind === 'ok')).toBe(true);
    expect(ctx.api.calls.refresh).toBe(1);
    expect(ctx.api.calls.me).toBe(8); // 4 first attempts + 4 retries
  });

  it('expired access -> successful refresh -> 401: exactly one refresh, then the session is cleared', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.clock.advance(ACCESS_TTL_MS + 1000); // the access token is expired at the start
    ctx.api.forced.me = { kind: 'error', status: 401 }; // and the API refuses even the renewed one

    const result = await ctx.manager.request((token) => ctx.api.me(token));

    expect(result.kind).toBe('unauthorized');
    expect(ctx.api.calls.refresh).toBe(1); // no second refresh
    expect(ctx.api.calls.me).toBe(1); // and no retry
    expect(snap(ctx)).toMatchObject({
      status: 'signedOut',
      user: null,
      notice: 'expired',
    });
    await flush(); // the storage clear is queued
    expect(ctx.storage.value).toBeNull();
    expect(ctx.storage.log.at(-1)).toBe('clear');
  });

  it('counts a refresh shared by simultaneous calls: still exactly one refresh in total', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    ctx.api.forced.me = { kind: 'error', status: 401 };
    ctx.api.gates.refresh.hold();

    const calls = Array.from({ length: 4 }, () =>
      ctx.manager.request((token) => ctx.api.me(token)),
    );
    await flush();
    ctx.api.gates.refresh.open();
    const results = await Promise.all(calls);

    // The first call to see the 401 ends the session; the others then find the
    // session gone (cancelled). Nobody succeeds and nobody refreshes again.
    expect(results.some((r) => r.kind === 'unauthorized')).toBe(true);
    expect(
      results.every((r) => r.kind === 'unauthorized' || r.kind === 'cancelled'),
    ).toBe(true);
    expect(ctx.api.calls.refresh).toBe(1);
    expect(ctx.api.calls.me).toBe(4); // one attempt each, no retries
    expect(snap(ctx).status).toBe('signedOut');
    await flush();
    expect(ctx.storage.value).toBeNull();
  });

  it('a valid-looking token that gets a 401 is renewed once and retried once, then a second 401 ends the session', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.api.forced.me = { kind: 'error', status: 401 };

    const result = await ctx.manager.request((token) => ctx.api.me(token));

    expect(result.kind).toBe('unauthorized');
    expect(ctx.api.calls.refresh).toBe(1);
    expect(ctx.api.calls.me).toBe(2);
    expect(snap(ctx).status).toBe('signedOut');
  });

  it('a logout during the call after the start-up refresh keeps the race rules (nothing is stored again)', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    ctx.api.gates.me.hold();

    const pending = ctx.manager.request((token) => ctx.api.me(token));
    await vi.waitFor(() => expect(ctx.api.calls.me).toBe(1)); // renewed, call is on the wire
    const logout = ctx.manager.logout();
    ctx.api.forced.me = { kind: 'error', status: 401 };
    ctx.api.gates.me.open();
    const [result] = await Promise.all([pending, logout]);

    expect(result.kind).not.toBe('ok');
    expect(ctx.api.calls.refresh).toBe(1);
    expect(snap(ctx)).toMatchObject({ status: 'signedOut', notice: 'logout' });
    expect(ctx.storage.value).toBeNull();
  });

  it('survives a failed secure write after renewing (session stays in memory)', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    ctx.storage.failSaves = true;

    const result = await ctx.manager.request((token) => ctx.api.me(token));

    expect(result.kind).toBe('ok');
    expect(snap(ctx).status).toBe('signedIn');
  });
});

describe('SessionManager: logout', () => {
  it('signs out locally at once and revokes the server session', async () => {
    const ctx = setup();
    await signIn(ctx);

    const result = await ctx.manager.logout();

    expect(result).toBe('revoked');
    expect(snap(ctx)).toMatchObject({
      status: 'signedOut',
      user: null,
      notice: 'logout',
    });
    expect(ctx.storage.value).toBeNull();
    expect(ctx.api.sessions[0]!.revoked).toBe(true);
    expect(ctx.api.calls.refresh).toBe(0);
  });

  it('renews an expired access token first, because the logout endpoint needs one', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.clock.advance(ACCESS_TTL_MS + 1000);

    expect(await ctx.manager.logout()).toBe('revoked');

    expect(ctx.api.calls.refresh).toBe(1);
    expect(ctx.api.sessions[0]!.revoked).toBe(true);
  });

  it('treats a refused refresh as an already ended session', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    ctx.api.sessions[0]!.revoked = true;

    expect(await ctx.manager.logout()).toBe('already-invalid');

    expect(ctx.api.calls.logout).toBe(0);
    expect(ctx.storage.value).toBeNull();
  });

  it('completes the local sign-out and says so when the API is unreachable', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.api.forced.logout = { kind: 'unreachable' };

    expect(await ctx.manager.logout()).toBe('failed');

    expect(snap(ctx)).toMatchObject({
      status: 'signedOut',
      notice: 'logout-local',
    });
    expect(ctx.storage.value).toBeNull();
    expect(ctx.api.sessions[0]!.revoked).toBe(false); // honest: not revoked
  });

  it('also signs out locally when an expired token cannot be renewed (offline)', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    ctx.api.forced.refresh = { kind: 'unreachable' };

    expect(await ctx.manager.logout()).toBe('failed');

    expect(snap(ctx).notice).toBe('logout-local');
    expect(ctx.storage.value).toBeNull();
  });

  it('does nothing on the server when there is no session', async () => {
    const ctx = setup();
    expect(await ctx.manager.logout()).toBe('none');
    expect(ctx.api.calls.logout).toBe(0);
  });
});

describe('SessionManager: races', () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = setup();
    await signIn(ctx);
  });

  const listStorage = () => ctx.storage.log.join(',');

  it('a refresh still on the wire cannot bring back a session that was logged out', async () => {
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    ctx.api.gates.refresh.hold();
    const pending = ctx.manager.request((token) => ctx.api.me(token));
    await flush();
    expect(ctx.api.calls.refresh).toBe(1);

    const logout = ctx.manager.logout(); // starts while the refresh is in flight
    ctx.api.gates.refresh.open();
    const [result, logoutResult] = await Promise.all([pending, logout]);

    expect(result.kind).toBe('cancelled');
    expect(logoutResult).toBe('revoked');
    // Browser-side equivalents: nothing was stored again, the state stays signed out.
    expect(ctx.storage.value).toBeNull();
    expect(listStorage()).toBe('save,clear');
    expect(snap(ctx).status).toBe('signedOut');
    // Server side: the session is revoked and stays that way.
    expect(ctx.api.sessions[0]!.revoked).toBe(true);
    expect(ctx.api.calls.refresh).toBe(1); // joined, not repeated
  });

  it('an old refresh answer cannot overwrite a sign-in made after the logout', async () => {
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    ctx.api.gates.refresh.hold();
    const pending = ctx.manager.request((token) => ctx.api.me(token));
    await flush();

    const logout = ctx.manager.logout();
    await flush();
    await signIn(ctx); // a brand-new session while the old refresh is still out
    const second = { ...ctx.storage.value! };
    ctx.api.gates.refresh.open();
    await Promise.all([pending, logout]);
    await flush();

    expect(snap(ctx)).toMatchObject({ status: 'signedIn' });
    expect(ctx.storage.value).toEqual(second); // the NEW session's tokens are what is stored
    expect(ctx.api.sessions[0]!.revoked).toBe(true);
    expect(ctx.api.sessions[1]!.revoked).toBe(false);
    // And it still works.
    expect((await ctx.manager.request((token) => ctx.api.me(token))).kind).toBe(
      'ok',
    );
  });

  it('a slow secure write cannot land after the logout that followed it', async () => {
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    ctx.storage.saveDelayMs = 30;

    const renewal = ctx.manager.request((token) => ctx.api.me(token));
    await vi.waitFor(() => expect(ctx.api.calls.refresh).toBe(1));
    await renewal; // the renewal's write is queued, maybe still running
    await ctx.manager.logout();
    await new Promise((r) => setTimeout(r, 80));

    expect(ctx.storage.value).toBeNull();
    expect(ctx.storage.log.at(-1)).toBe('clear');
  });

  it('a sign-in that finishes after a logout is not applied and its session is revoked', async () => {
    await ctx.manager.logout();
    ctx.api.gates.login.hold();

    const login = ctx.manager.login(creds(ctx.accounts.influencer));
    await flush();
    const logout = ctx.manager.logout(); // user gives up while the sign-in is running
    ctx.api.gates.login.open();
    const result = await login;
    await logout;
    await flush();

    expect(result).toEqual({ kind: 'cancelled' });
    expect(snap(ctx).status).toBe('signedOut');
    expect(ctx.storage.value).toBeNull();
    expect(ctx.api.sessions.at(-1)!.revoked).toBe(true); // the late session was revoked
  });

  it('a validation that finishes after a logout changes nothing', async () => {
    ctx.clock.advance(60_000);
    ctx.api.gates.me.hold();
    const validation = ctx.manager.validate();
    await flush();

    await ctx.manager.logout();
    ctx.api.gates.me.open();
    await validation;

    expect(snap(ctx)).toMatchObject({
      status: 'signedOut',
      user: null,
      notice: 'logout',
    });
  });
});
