import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from '@/session/session-manager';
import {
  ACCESS_TTL_MS,
  Clock,
  FakeApi,
  MemoryStorage,
  user,
} from '@/session/test-support';
import { FakeVenuesApi, venue } from './test-support';
import {
  bindVenueCacheToSession,
  createMyVenuesFetcher,
  myVenuesKey,
  venuesKeyPrefix,
  VenueLoadError,
} from './venues-query';

const PASSWORD = 'correct horse battery';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const clock = new Clock();
  const server = new FakeApi(clock);
  const storage = new MemoryStorage();
  const manager = new SessionManager({ api: server, storage, now: clock.now });
  const venuesApi = new FakeVenuesApi(server);
  const fetchMyVenues = createMyVenuesFetcher({ manager, api: venuesApi });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const owners = {
    a: user('VENUE_OWNER', {
      id: '00000000-0000-4000-8000-0000000000a1',
      email: 'a@kafe.example',
      name: 'Sahip A',
    }),
    b: user('VENUE_OWNER', {
      id: '00000000-0000-4000-8000-0000000000a2',
      email: 'b@kafe.example',
      name: 'Sahip B',
    }),
    empty: user('VENUE_OWNER', {
      id: '00000000-0000-4000-8000-0000000000a3',
      email: 'c@kafe.example',
      name: 'Sahip C',
    }),
    influencer: user('INFLUENCER'),
  };
  for (const account of Object.values(owners))
    server.addAccount(PASSWORD, account);
  venuesApi.byEmail.set(owners.a.email, [venue(1, 2), venue(2, 1)]); // two venues, one with two branches
  venuesApi.byEmail.set(owners.b.email, [venue(3, 1)]);

  const signIn = async (account: (typeof owners)[keyof typeof owners]) => {
    await manager.start();
    expect(
      await manager.login({ email: account.email, password: PASSWORD }),
    ).toEqual({ kind: 'ok' });
    return account.id;
  };
  // What the screen does: a query keyed by the user.
  const load = (userId: string) =>
    queryClient.fetchQuery({
      queryKey: myVenuesKey(userId),
      queryFn: () => fetchMyVenues(userId),
    });

  return {
    clock,
    server,
    storage,
    manager,
    venuesApi,
    fetchMyVenues,
    queryClient,
    owners,
    signIn,
    load,
  };
}
type Ctx = ReturnType<typeof setup>;

describe("loading the signed-in owner's venues", () => {
  let ctx: Ctx;
  beforeEach(() => {
    ctx = setup();
  });

  it('shows an owner their own venues, each with its own branches', async () => {
    const id = await ctx.signIn(ctx.owners.a);

    const data = await ctx.load(id);

    expect(
      data.items.map((v) => [v.name, v.branches.map((b) => b.name)]),
    ).toEqual([
      ['Mekan 1', ['Şube 1.1', 'Şube 1.2']],
      ['Mekan 2', ['Şube 2.1']],
    ]);
  });

  it('shows each of two different owners only their own', async () => {
    const aId = await ctx.signIn(ctx.owners.a);
    const a = await ctx.load(aId);
    await ctx.manager.logout();
    const bId = await ctx.signIn(ctx.owners.b);
    const b = await ctx.load(bId);

    expect(a.items.map((v) => v.name)).toEqual(['Mekan 1', 'Mekan 2']);
    expect(b.items.map((v) => v.name)).toEqual(['Mekan 3']);
    expect(JSON.stringify(b)).not.toMatch(/Mekan [12]\b/);
  });

  it('returns an empty list for an owner without venues', async () => {
    const id = await ctx.signIn(ctx.owners.empty);
    expect((await ctx.load(id)).items).toEqual([]);
  });

  it('never sends a user id or owner id: only the access token identifies the owner', async () => {
    const id = await ctx.signIn(ctx.owners.a);
    await ctx.load(id);
    expect(ctx.venuesApi.tokensSeen).toHaveLength(1);
    expect(ctx.venuesApi.tokensSeen[0]).toMatch(/^at-/);
  });

  describe('failures are told apart', () => {
    const reason = async (ctx: Ctx, id: string) =>
      ctx.load(id).then(
        () => 'loaded',
        (error: unknown) =>
          error instanceof VenueLoadError ? error.reason : 'other',
      );

    it.each([
      ['an unreachable API', { kind: 'unreachable' } as const, 'unreachable'],
      ['a server error', { kind: 'error', status: 500 } as const, 'unexpected'],
      ['rate limiting', { kind: 'error', status: 429 } as const, 'unexpected'],
      [
        'an answer that breaks the shared schema',
        { kind: 'error', status: 502 } as const,
        'unexpected',
      ],
      [
        'a plain 403 (the role may have changed)',
        { kind: 'error', status: 403 } as const,
        'forbidden',
      ],
    ])('maps %s to "%s"', async (_label, forced, expected) => {
      const id = await ctx.signIn(ctx.owners.a);
      ctx.venuesApi.forced = forced;

      expect(await reason(ctx, id)).toBe(expected);
      expect(ctx.manager.getSnapshot().status).toBe('signedIn'); // none of these ends the session
    });

    it('treats a revoked session as "ended" (not a connection problem) and signs out', async () => {
      const id = await ctx.signIn(ctx.owners.a);
      ctx.server.sessions[0]!.revoked = true;

      expect(await reason(ctx, id)).toBe('ended');

      expect(ctx.manager.getSnapshot()).toMatchObject({
        status: 'signedOut',
        notice: 'expired',
      });
      await flush();
      expect(ctx.storage.value).toBeNull();
    });

    it('treats a suspended account as "ended" with the account-status notice', async () => {
      const id = await ctx.signIn(ctx.owners.a);
      ctx.venuesApi.forced = {
        kind: 'error',
        status: 403,
        code: 'ACCOUNT_SUSPENDED',
      };

      expect(await reason(ctx, id)).toBe('ended');

      expect(ctx.manager.getSnapshot()).toMatchObject({
        status: 'signedOut',
        notice: 'inactive',
      });
    });

    it('a retry after a failure loads the data', async () => {
      const id = await ctx.signIn(ctx.owners.a);
      ctx.venuesApi.forced = { kind: 'unreachable' };
      expect(await reason(ctx, id)).toBe('unreachable');

      ctx.venuesApi.forced = undefined;
      expect((await ctx.load(id)).items).toHaveLength(2);
    });
  });

  it('uses the existing renewal when the access token has expired: one refresh, then the data', async () => {
    const id = await ctx.signIn(ctx.owners.a);
    const stale = ctx.venuesApi.tokensSeen.length;
    ctx.clock.advance(ACCESS_TTL_MS + 1000);

    const data = await ctx.load(id);

    expect(data.items).toHaveLength(2);
    expect(ctx.server.calls.refresh).toBe(1);
    expect(ctx.venuesApi.tokensSeen.length).toBe(stale + 1); // asked once, with the renewed token
  });

  it('follows a role change: the API refuses (403) and a validation shows the new role', async () => {
    const id = await ctx.signIn(ctx.owners.a);
    ctx.server.sessions[0]!.user = ctx.owners.influencer;

    const failure = await ctx.load(id).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(VenueLoadError);
    expect((failure as VenueLoadError).reason).toBe('forbidden');

    // What the screen then does.
    await ctx.manager.validate({ force: true });
    expect(ctx.manager.getSnapshot()).toMatchObject({
      status: 'signedIn',
      user: { role: 'INFLUENCER' },
    });
  });
});

describe('no data leaks between users', () => {
  let ctx: Ctx;
  let unbind: () => void;
  beforeEach(() => {
    ctx = setup();
    unbind = bindVenueCacheToSession(ctx.manager, ctx.queryClient);
  });

  const cacheText = (c: Ctx) =>
    JSON.stringify(
      c.queryClient
        .getQueryCache()
        .getAll()
        .map((q) => [q.queryKey, q.state.data]),
    );

  it("removes the previous owner's venues from the cache when they sign out", async () => {
    const id = await ctx.signIn(ctx.owners.a);
    await ctx.load(id);
    expect(cacheText(ctx)).toContain('Mekan 1');

    await ctx.manager.logout();

    expect(
      ctx.queryClient.getQueryCache().findAll({ queryKey: venuesKeyPrefix }),
    ).toHaveLength(0);
    expect(ctx.queryClient.getQueryData(myVenuesKey(id))).toBeUndefined();
    unbind();
  });

  it('keeps the data when only the tokens are renewed for the same user', async () => {
    const id = await ctx.signIn(ctx.owners.a);
    await ctx.load(id);
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    await ctx.manager.request((token) => ctx.server.me(token)); // renews the tokens

    expect(ctx.queryClient.getQueryData(myVenuesKey(id))).toBeDefined();
    unbind();
  });

  it('sign out -> another user signs in: the new user never sees the old data', async () => {
    const aId = await ctx.signIn(ctx.owners.a);
    await ctx.load(aId);
    await ctx.manager.logout();
    const bId = await ctx.signIn(ctx.owners.b);

    expect(ctx.queryClient.getQueryData(myVenuesKey(bId))).toBeUndefined();
    await ctx.load(bId);
    expect(cacheText(ctx)).toContain('Mekan 3');
    expect(cacheText(ctx)).not.toMatch(/Mekan [12]\b|Şube 1\./);
    unbind();
  });

  it('a late answer to a request started before sign-out cannot bring the old data back', async () => {
    const aId = await ctx.signIn(ctx.owners.a);
    ctx.venuesApi.hold();

    const lateA = ctx.load(aId).then(
      () => 'resolved',
      (error: unknown) => (error instanceof Error ? 'rejected' : 'other'),
    );
    await vi.waitFor(() => expect(ctx.venuesApi.calls).toBe(1));

    // The API already answered with A's data; delivery is delayed. Meanwhile:
    await ctx.manager.logout();
    const bId = await ctx.signIn(ctx.owners.b);
    ctx.venuesApi.release();

    expect(await lateA).toBe('rejected');
    expect(ctx.queryClient.getQueryData(myVenuesKey(aId))).toBeUndefined();
    // B sees only B.
    await ctx.load(bId);
    expect(cacheText(ctx)).not.toMatch(/Mekan [12]\b/);
    expect(ctx.queryClient.getQueryData(myVenuesKey(bId))).toMatchObject({
      items: [{ name: 'Mekan 3' }],
    });
    unbind();
  });

  it('a late answer is dropped even without any cache clearing (the manager and the user check do it)', async () => {
    unbind(); // no cache binding at all
    const aId = await ctx.signIn(ctx.owners.a);
    ctx.venuesApi.hold();
    const late = ctx.fetchMyVenues(aId).then(
      () => 'resolved',
      (error: unknown) =>
        error instanceof VenueLoadError ? error.reason : 'other',
    );
    await vi.waitFor(() => expect(ctx.venuesApi.calls).toBe(1));

    await ctx.manager.logout();
    await ctx.signIn(ctx.owners.b);
    ctx.venuesApi.release();

    expect(await late).toBe('stale');
  });

  it('a late answer for user A is "stale" even when the signed-in user is now B and the request was B\'s own call', async () => {
    unbind();
    await ctx.signIn(ctx.owners.b);
    // The screen still asks for A's key (a render from before the switch).
    await expect(ctx.fetchMyVenues(ctx.owners.a.id)).rejects.toMatchObject({
      reason: 'stale',
    });
  });
});
