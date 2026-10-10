import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindUserCacheToSession } from '@/session/bind-user-cache';
import { SessionManager } from '@/session/session-manager';
import {
  ACCESS_TTL_MS,
  Clock,
  FakeApi,
  MemoryStorage,
  user,
} from '@/session/test-support';
import {
  createDiscoverService,
  DiscoverLoadError,
  discoverDetailKey,
  discoverKeyPrefix,
  discoverListKey,
  discoverUserKey,
} from './discover-query';
import { discoverOffer, FakeDiscoverApi } from './test-support';

const PASSWORD = 'correct horse battery';
const reasonOf = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (e: unknown) => (e instanceof DiscoverLoadError ? e.reason : 'other'),
  );

function setup() {
  const clock = new Clock();
  const server = new FakeApi(clock);
  const manager = new SessionManager({
    api: server,
    storage: new MemoryStorage(),
    now: clock.now,
  });
  const api = new FakeDiscoverApi(server);
  const service = createDiscoverService({ manager, api });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const people = {
    a: user('INFLUENCER', {
      id: '00000000-0000-4000-8000-0000000000c1',
      email: 'a@inf.example',
      name: 'Influencer A',
    }),
    b: user('INFLUENCER', {
      id: '00000000-0000-4000-8000-0000000000c2',
      email: 'b@inf.example',
      name: 'Influencer B',
    }),
    owner: user('VENUE_OWNER'),
  };
  for (const person of Object.values(people))
    server.addAccount(PASSWORD, person);
  const signIn = async (person: (typeof people)[keyof typeof people]) => {
    await manager.start();
    expect(
      await manager.login({ email: person.email, password: PASSWORD }),
    ).toEqual({ kind: 'ok' });
    return person.id;
  };
  return { clock, server, manager, api, service, queryClient, people, signIn };
}
type Ctx = ReturnType<typeof setup>;

describe('discover service: reading', () => {
  let ctx: Ctx;
  beforeEach(() => {
    ctx = setup();
    ctx.api.add(discoverOffer(1));
    ctx.api.add(discoverOffer(2));
  });

  it('lists the visible offers and opens one', async () => {
    const id = await ctx.signIn(ctx.people.a);
    const page = await ctx.service.loadPage(id, 1);
    expect(page.items.map((o) => o.title)).toEqual(['İlan 1', 'İlan 2']);
    expect(
      (await ctx.service.loadOffer(id, discoverOffer(1).id)).venue.name,
    ).toBe('Mekan 1');
  });

  it('an offer that is not visible any more is "not-found" on the detail and gone from the list', async () => {
    const id = await ctx.signIn(ctx.people.a);
    expect((await ctx.service.loadPage(id, 1)).items).toHaveLength(2);
    ctx.api.visible.delete(discoverOffer(1).id); // suspended / ended meanwhile
    expect(await reasonOf(ctx.service.loadOffer(id, discoverOffer(1).id))).toBe(
      'not-found',
    );
    expect(
      (await ctx.service.loadPage(id, 1)).items.map((o) => o.title),
    ).toEqual(['İlan 2']);
  });

  it.each([
    ['unreachable', { kind: 'unreachable' } as const, 'unreachable'],
    ['a 500', { kind: 'error', status: 500 } as const, 'unexpected'],
    [
      'a contract mismatch (502)',
      { kind: 'error', status: 502 } as const,
      'unexpected',
    ],
    ['a plain 403', { kind: 'error', status: 403 } as const, 'forbidden'],
    ['a 404', { kind: 'error', status: 404 } as const, 'not-found'],
  ])('maps %s to "%s"', async (_label, forced, reason) => {
    const id = await ctx.signIn(ctx.people.a);
    ctx.api.forced.get = forced;
    expect(await reasonOf(ctx.service.loadOffer(id, discoverOffer(1).id))).toBe(
      reason,
    );
    expect(ctx.manager.getSnapshot().status).toBe('signedIn');
  });

  it('a revoked session is "ended", not a connection error', async () => {
    const id = await ctx.signIn(ctx.people.a);
    ctx.server.sessions[0]!.revoked = true;
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    expect(await reasonOf(ctx.service.loadPage(id, 1))).toBe('ended');
    expect(ctx.manager.getSnapshot()).toMatchObject({
      status: 'signedOut',
      notice: 'expired',
    });
  });

  it('uses the existing renewal for an expired access token (one refresh)', async () => {
    const id = await ctx.signIn(ctx.people.a);
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    await ctx.service.loadPage(id, 1);
    expect(ctx.server.calls.refresh).toBe(1);
  });

  it('a 401 on a read renews once and repeats it once', async () => {
    const id = await ctx.signIn(ctx.people.a);
    const [first] = [...ctx.server.sessions[0]!.accessTokens];
    ctx.server.sessions[0]!.accessTokens.delete(first!);
    expect((await ctx.service.loadPage(id, 1)).items).toHaveLength(2);
    expect(ctx.server.calls.refresh).toBe(1);
    expect(ctx.api.calls.list).toBe(2);
  });

  it('an account that is not an influencer (role changed) gets "forbidden" and keeps its session', async () => {
    const id = await ctx.signIn(ctx.people.owner);
    expect(await reasonOf(ctx.service.loadPage(id, 1))).toBe('forbidden');
    expect(ctx.manager.getSnapshot().status).toBe('signedIn');
  });
});

describe('discover: isolation, late answers, roles', () => {
  let ctx: Ctx;
  let unbind: () => void;
  beforeEach(() => {
    ctx = setup();
    ctx.api.add(discoverOffer(1));
    unbind = bindUserCacheToSession(ctx.manager, ctx.queryClient, [
      discoverKeyPrefix,
    ]);
  });
  const cacheText = () =>
    JSON.stringify(
      ctx.queryClient
        .getQueryCache()
        .getAll()
        .map((q) => [q.queryKey, q.state.data]),
    );

  it('keys are user-bound', () => {
    expect(discoverUserKey('u1')).toEqual(['discover', 'offers', 'u1']);
    expect(discoverDetailKey('u1', 'o1')).toEqual([
      'discover',
      'offers',
      'u1',
      'detail',
      'o1',
    ]);
    expect(discoverListKey('u1')).not.toEqual(discoverListKey('u2'));
  });

  it('sign-out empties the discovery cache; the next user starts with none of the previous data', async () => {
    const a = await ctx.signIn(ctx.people.a);
    await ctx.queryClient.fetchQuery({
      queryKey: discoverListKey(a),
      queryFn: () => ctx.service.loadPage(a, 1),
    });
    await ctx.queryClient.fetchQuery({
      queryKey: discoverDetailKey(a, discoverOffer(1).id),
      queryFn: () => ctx.service.loadOffer(a, discoverOffer(1).id),
    });
    expect(cacheText()).toContain('Mekan 1');

    await ctx.manager.logout();
    const b = await ctx.signIn(ctx.people.b);

    expect(
      ctx.queryClient.getQueryCache().findAll({ queryKey: discoverKeyPrefix }),
    ).toHaveLength(0);
    expect(ctx.queryClient.getQueryData(discoverListKey(b))).toBeUndefined();
    expect(ctx.queryClient.getQueryData(discoverListKey(a))).toBeUndefined();
    unbind();
  });

  it('a role change to another role drops the influencer data too (the user id stays, the cache must not)', async () => {
    // The same user id with a new role: the queries are only enabled for INFLUENCER
    // (see use-discover) and the API refuses the new role, so no old list is served.
    const a = await ctx.signIn(ctx.people.a);
    const page = await ctx.service.loadPage(a, 1);
    expect(page.items).toHaveLength(1);
    ctx.server.sessions[0]!.user = {
      ...ctx.server.sessions[0]!.user,
      role: 'VENUE_OWNER',
    };
    expect(await reasonOf(ctx.service.loadPage(a, 1))).toBe('forbidden');
    unbind();
  });

  it.each(['list', 'detail'] as const)(
    'a late %s answer started before sign-out is dropped after another user signs in',
    async (kind) => {
      const a = await ctx.signIn(ctx.people.a);
      ctx.api.hold();
      const late = reasonOf(
        kind === 'list'
          ? ctx.service.loadPage(a, 1)
          : ctx.service.loadOffer(a, discoverOffer(1).id),
      );
      await vi.waitFor(() =>
        expect(ctx.api.calls[kind === 'list' ? 'list' : 'get']).toBe(1),
      );

      await ctx.manager.logout();
      await ctx.signIn(ctx.people.b);
      ctx.api.release();

      expect(await late).toBe('stale');
      unbind();
    },
  );

  it('a late answer after sign-out (nobody signed in yet) is dropped too', async () => {
    const a = await ctx.signIn(ctx.people.a);
    ctx.api.hold();
    const late = reasonOf(ctx.service.loadPage(a, 1));
    await vi.waitFor(() => expect(ctx.api.calls.list).toBe(1));
    await ctx.manager.logout();
    ctx.api.release();
    expect(await late).toBe('stale');
    unbind();
  });
});
