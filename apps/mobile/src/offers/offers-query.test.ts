import type { CreateOfferRequest } from '@gossip/shared';
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
import { newIdempotencyKey } from './idempotency-key';
import { applyWriteOutcome } from './offers-cache';
import {
  createOffersService,
  OfferLoadError,
  offerDetailKey,
  offersKeyPrefix,
  offersListKey,
  offersUserKey,
} from './offers-query';
import { FakeOffersApi, offerRequest } from './test-support';

const PASSWORD = 'correct horse battery';
const BRANCH_A = '00000000-0000-4000-8000-0000000000a1';
const BRANCH_A2 = '00000000-0000-4000-8000-0000000000a2';
const BRANCH_B = '00000000-0000-4000-8000-0000000000b1';

function setup() {
  const clock = new Clock();
  const server = new FakeApi(clock);
  const storage = new MemoryStorage();
  const manager = new SessionManager({ api: server, storage, now: clock.now });
  const offersApi = new FakeOffersApi(server);
  const rawService = createOffersService({ manager, api: offersApi });
  // Most tests don't care about the key: they get a fresh one.
  const service = {
    ...rawService,
    create: (
      userId: string,
      body: CreateOfferRequest,
      key = newIdempotencyKey(),
    ) => rawService.create(userId, body, key),
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const owners = {
    a: user('VENUE_OWNER', {
      id: '00000000-0000-4000-8000-0000000000c1',
      email: 'a@kafe.example',
      name: 'Sahip A',
    }),
    b: user('VENUE_OWNER', {
      id: '00000000-0000-4000-8000-0000000000c2',
      email: 'b@kafe.example',
      name: 'Sahip B',
    }),
    influencer: user('INFLUENCER'),
  };
  for (const account of Object.values(owners))
    server.addAccount(PASSWORD, account);
  offersApi.addBranch(BRANCH_A, owners.a.email, 'Kadıköy', 'Kafe A');
  offersApi.addBranch(BRANCH_A2, owners.a.email, 'Beşiktaş', 'Bar A');
  offersApi.addBranch(BRANCH_B, owners.b.email, 'Çankaya', 'Restoran B');
  const signIn = async (account: (typeof owners)[keyof typeof owners]) => {
    await manager.start();
    expect(
      await manager.login({ email: account.email, password: PASSWORD }),
    ).toEqual({ kind: 'ok' });
    return account.id;
  };
  return {
    clock,
    server,
    storage,
    manager,
    offersApi,
    service,
    queryClient,
    owners,
    signIn,
  };
}
type Ctx = ReturnType<typeof setup>;

describe('offers service: reading', () => {
  let ctx: Ctx;
  beforeEach(() => {
    ctx = setup();
  });

  it("lists only the signed-in owner's offers and reads their detail", async () => {
    const a = await ctx.signIn(ctx.owners.a);
    const created = await ctx.service.create(
      a,
      offerRequest(BRANCH_A, { title: 'A nın ilanı' }),
    );
    await ctx.manager.logout();
    const b = await ctx.signIn(ctx.owners.b);
    await ctx.service.create(
      b,
      offerRequest(BRANCH_B, { title: 'B nin ilanı' }),
    );

    const listB = await ctx.service.loadPage(b, 1);

    expect(listB.items.map((o) => o.title)).toEqual(['B nin ilanı']);
    expect(
      created.kind === 'ok' &&
        (await ctx.service
          .loadOffer(b, created.offer.id)
          .catch((e: unknown) => e)),
    ).toBeInstanceOf(OfferLoadError);
  });

  it.each([
    ['unreachable', { kind: 'unreachable' } as const, 'unreachable'],
    ['a 500', { kind: 'error', status: 500 } as const, 'unexpected'],
    [
      'a schema mismatch (502)',
      { kind: 'error', status: 502 } as const,
      'unexpected',
    ],
    ['a plain 403', { kind: 'error', status: 403 } as const, 'forbidden'],
    ['a 404', { kind: 'error', status: 404 } as const, 'not-found'],
  ])('maps %s on a read to "%s"', async (_label, forced, reason) => {
    const id = await ctx.signIn(ctx.owners.a);
    ctx.offersApi.forced.get = forced;
    await expect(ctx.service.loadOffer(id, 'x')).rejects.toMatchObject({
      reason,
    });
    expect(ctx.manager.getSnapshot().status).toBe('signedIn');
  });

  it('shows a missing or foreign offer as not found', async () => {
    const a = await ctx.signIn(ctx.owners.a);
    const mine = await ctx.service.create(a, offerRequest(BRANCH_A));
    await ctx.manager.logout();
    const b = await ctx.signIn(ctx.owners.b);

    await expect(
      ctx.service.loadOffer(b, mine.kind === 'ok' ? mine.offer.id : ''),
    ).rejects.toMatchObject({ reason: 'not-found' });
  });

  it('treats a revoked session as "ended", not a connection error', async () => {
    const id = await ctx.signIn(ctx.owners.a);
    ctx.server.sessions[0]!.revoked = true;
    await expect(ctx.service.loadPage(id, 1)).rejects.toMatchObject({
      reason: 'ended',
    });
    expect(ctx.manager.getSnapshot()).toMatchObject({
      status: 'signedOut',
      notice: 'expired',
    });
  });

  it('uses the existing renewal for an expired access token', async () => {
    const id = await ctx.signIn(ctx.owners.a);
    ctx.clock.advance(ACCESS_TTL_MS + 1000);
    await ctx.service.loadPage(id, 1);
    expect(ctx.server.calls.refresh).toBe(1);
  });
});

describe('offers service: writes', () => {
  let ctx: Ctx;
  let id: string;
  beforeEach(async () => {
    ctx = setup();
    id = await ctx.signIn(ctx.owners.a);
  });

  const createDraft = async () => {
    const outcome = await ctx.service.create(id, offerRequest(BRANCH_A));
    if (outcome.kind !== 'ok')
      throw new Error('expected the draft to be created');
    return outcome.offer;
  };

  it('creates a DRAFT, edits it, and publishes it as a separate step', async () => {
    const draft = await createDraft();
    expect(draft.status).toBe('DRAFT');
    const { branchId: _b, ...fields } = offerRequest(BRANCH_A, {
      title: 'Yeni başlık',
    });
    void _b;

    const edited = await ctx.service.update(id, draft.id, fields);
    expect(edited).toMatchObject({
      kind: 'ok',
      offer: { title: 'Yeni başlık', status: 'DRAFT' },
    });

    const published = await ctx.service.publish(id, draft.id);
    expect(published).toMatchObject({
      kind: 'ok',
      offer: { status: 'PUBLISHED' },
    });
  });

  it('refuses to edit a published offer (the API says OFFER_NOT_DRAFT)', async () => {
    const draft = await createDraft();
    await ctx.service.publish(id, draft.id);
    const { branchId: _b, ...fields } = offerRequest(BRANCH_A);
    void _b;
    expect(await ctx.service.update(id, draft.id, fields)).toEqual({
      kind: 'conflict',
      code: 'OFFER_NOT_DRAFT',
    });
  });

  it.each([
    'NO_ACTIVE_SUBSCRIPTION',
    'QUOTA_EXCEEDED',
    'OFFER_EXPIRED',
    'OFFER_NOT_DRAFT',
  ] as const)(
    'reports the publish refusal %s as a conflict with its code',
    async (code) => {
      const draft = await createDraft();
      ctx.offersApi.publishRefusal = code;
      expect(await ctx.service.publish(id, draft.id)).toEqual({
        kind: 'conflict',
        code,
      });
    },
  );

  it('publishing twice does not execute a second publish', async () => {
    const draft = await createDraft();
    await ctx.service.publish(id, draft.id);
    const again = await ctx.service.publish(id, draft.id);
    expect(again).toMatchObject({ kind: 'ok', offer: { status: 'PUBLISHED' } });
    expect(ctx.offersApi.executed.publish).toBe(1);
  });

  it('refuses a branch of another owner (not found)', async () => {
    expect(await ctx.service.create(id, offerRequest(BRANCH_B))).toEqual({
      kind: 'not-found',
    });
    expect(ctx.offersApi.executed.create).toBe(0);
  });

  describe('no automatic repeat of a write', () => {
    it.each([
      ['a network error', { kind: 'unreachable' } as const],
      ['a 500', { kind: 'error', status: 500 } as const],
      ['a 503', { kind: 'error', status: 503 } as const],
      [
        'a 502 (answer breaks the contract)',
        { kind: 'error', status: 502 } as const,
      ],
    ])(
      '%s is "unknown" and the call is made exactly once',
      async (_label, forced) => {
        const draft = await createDraft();
        for (const method of ['create', 'update', 'publish'] as const) {
          const before = ctx.offersApi.calls[method];
          ctx.offersApi.forced[method] = forced;
          const outcome =
            method === 'create'
              ? await ctx.service.create(id, offerRequest(BRANCH_A))
              : method === 'update'
                ? await ctx.service.update(
                    id,
                    draft.id,
                    (({ branchId: _b, ...f }) => f)(offerRequest(BRANCH_A)),
                  )
                : await ctx.service.publish(id, draft.id);
          expect(outcome).toEqual({ kind: 'unknown' });
          expect(ctx.offersApi.calls[method]).toBe(before + 1); // never retried
          ctx.offersApi.forced[method] = undefined;
        }
      },
    );

    it('a lost answer is never reported as a certain failure', async () => {
      const outcome = await (async () => {
        ctx.offersApi.forced.create = { kind: 'unreachable' };
        return ctx.service.create(id, offerRequest(BRANCH_A));
      })();
      expect(outcome.kind).not.toBe('conflict');
      expect(outcome.kind).not.toBe('invalid');
      expect(outcome.kind).toBe('unknown');
    });
  });

  describe('retrying after a 401 is safe', () => {
    it('a write rejected with 401 ran nothing on the server, so the one retry creates exactly one offer', async () => {
      // The server rejects the first access token (the AuthGuard answers before running anything).
      const [first] = [...ctx.server.sessions[0]!.accessTokens];
      ctx.server.sessions[0]!.accessTokens.delete(first!);

      const outcome = await ctx.service.create(id, offerRequest(BRANCH_A));

      expect(outcome.kind).toBe('ok');
      expect(ctx.server.calls.refresh).toBe(1);
      expect(ctx.offersApi.calls.create).toBe(2); // 401 (not executed) + the retry
      expect(ctx.offersApi.executed.create).toBe(1); // ...so one offer, not two
      expect(ctx.offersApi.offers.size).toBe(1);
    });

    it('an expired token is renewed BEFORE the write, so it is sent once', async () => {
      ctx.clock.advance(ACCESS_TTL_MS + 1000);
      expect((await ctx.service.create(id, offerRequest(BRANCH_A))).kind).toBe(
        'ok',
      );
      expect(ctx.offersApi.calls.create).toBe(1);
      expect(ctx.server.calls.refresh).toBe(1);
    });

    it('a second 401 ends the session instead of looping', async () => {
      ctx.offersApi.forced.publish = { kind: 'error', status: 401 };
      const draft = await createDraft();
      expect((await ctx.service.publish(id, draft.id)).kind).toBe('ended');
      expect(ctx.offersApi.calls.publish).toBe(2);
      expect(ctx.manager.getSnapshot().status).toBe('signedOut');
    });
  });

  it('an inactive account on a write ends the session', async () => {
    ctx.offersApi.forced.create = {
      kind: 'error',
      status: 403,
      code: 'ACCOUNT_SUSPENDED',
    };
    expect((await ctx.service.create(id, offerRequest(BRANCH_A))).kind).toBe(
      'ended',
    );
    expect(ctx.manager.getSnapshot()).toMatchObject({
      status: 'signedOut',
      notice: 'inactive',
    });
  });

  it('a plain 403 (role changed) is reported as forbidden and keeps the session', async () => {
    ctx.offersApi.forced.create = { kind: 'error', status: 403 };
    expect(await ctx.service.create(id, offerRequest(BRANCH_A))).toEqual({
      kind: 'forbidden',
    });
    expect(ctx.manager.getSnapshot().status).toBe('signedIn');
  });

  it('a rejected request body is reported as invalid, not as unknown', async () => {
    ctx.offersApi.forced.create = { kind: 'error', status: 400 };
    expect(await ctx.service.create(id, offerRequest(BRANCH_A))).toEqual({
      kind: 'invalid',
    });
  });
});

describe('create with an Idempotency-Key', () => {
  let ctx: Ctx;
  let id: string;
  beforeEach(async () => {
    ctx = setup();
    id = await ctx.signIn(ctx.owners.a);
  });
  const KEY = '0b6c9a52-4c3e-4c0a-9d4e-7a1f2b3c4d5e';

  it('sends the key it was given to the API', async () => {
    await ctx.service.create(id, offerRequest(BRANCH_A), KEY);
    expect(ctx.offersApi.createKeys).toEqual([KEY]);
  });

  it('a 401 retry inside request() sends the SAME key and still creates one offer', async () => {
    const [first] = [...ctx.server.sessions[0]!.accessTokens];
    ctx.server.sessions[0]!.accessTokens.delete(first!);

    const outcome = await ctx.service.create(id, offerRequest(BRANCH_A), KEY);

    expect(outcome.kind).toBe('ok');
    expect(ctx.offersApi.createKeys).toEqual([KEY, KEY]);
    expect(ctx.offersApi.executed.create).toBe(1);
    expect(ctx.offersApi.offers.size).toBe(1);
  });

  it('a lost answer, then the same save again with the same key: still one offer, and it is the same one', async () => {
    ctx.offersApi.loseAnswer.create = true;
    const lost = await ctx.service.create(id, offerRequest(BRANCH_A), KEY);
    expect(lost).toEqual({ kind: 'unknown' }); // not retried by the service
    expect(ctx.offersApi.calls.create).toBe(1);
    expect(ctx.offersApi.offers.size).toBe(1); // the server did create it

    ctx.offersApi.loseAnswer.create = false;
    const again = await ctx.service.create(id, offerRequest(BRANCH_A), KEY);

    expect(again.kind).toBe('ok');
    expect(ctx.offersApi.offers.size).toBe(1);
    expect(ctx.offersApi.executed.create).toBe(1);
    const [stored] = [...ctx.offersApi.offers.values()];
    expect(again.kind === 'ok' && again.offer.id).toBe(stored!.offer.id);
  });

  it('without the key a repeat after a lost answer would have made a second offer (what the key prevents)', async () => {
    ctx.offersApi.loseAnswer.create = true;
    await ctx.service.create(id, offerRequest(BRANCH_A));
    ctx.offersApi.loseAnswer.create = false;
    await ctx.service.create(id, offerRequest(BRANCH_A));
    expect(ctx.offersApi.offers.size).toBe(2);
  });

  it('the same key with different content is a conflict, not a second offer', async () => {
    await ctx.service.create(id, offerRequest(BRANCH_A), KEY);
    const outcome = await ctx.service.create(
      id,
      offerRequest(BRANCH_A, { title: 'Başka' }),
      KEY,
    );
    expect(outcome).toEqual({
      kind: 'conflict',
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
    expect(ctx.offersApi.offers.size).toBe(1);
  });

  it('a different owner using the same key gets their own offer', async () => {
    await ctx.service.create(id, offerRequest(BRANCH_A), KEY);
    await ctx.manager.logout();
    const b = await ctx.signIn(ctx.owners.b);
    const outcome = await ctx.service.create(b, offerRequest(BRANCH_B), KEY);
    expect(outcome.kind).toBe('ok');
    expect(ctx.offersApi.offers.size).toBe(2);
  });

  it('a 5xx or a network error is never repeated by the service, key or not', async () => {
    for (const forced of [
      { kind: 'unreachable' } as const,
      { kind: 'error', status: 503 } as const,
    ]) {
      ctx.offersApi.forced.create = forced;
      const before = ctx.offersApi.calls.create;
      expect(await ctx.service.create(id, offerRequest(BRANCH_A), KEY)).toEqual(
        {
          kind: 'unknown',
        },
      );
      expect(ctx.offersApi.calls.create).toBe(before + 1);
    }
  });
});

describe('late results and data isolation', () => {
  let ctx: Ctx;
  let unbind: () => void;
  beforeEach(() => {
    ctx = setup();
    unbind = bindUserCacheToSession(ctx.manager, ctx.queryClient, [
      offersKeyPrefix,
    ]);
  });
  const cacheText = () =>
    JSON.stringify(
      ctx.queryClient
        .getQueryCache()
        .getAll()
        .map((q) => [q.queryKey, q.state.data]),
    );

  it('empties the offer cache on sign-out and shows the next user nothing of the previous one', async () => {
    const a = await ctx.signIn(ctx.owners.a);
    await ctx.service.create(
      a,
      offerRequest(BRANCH_A, { title: 'Gizli A ilanı' }),
    );
    await ctx.queryClient.fetchQuery({
      queryKey: offersListKey(a),
      queryFn: () => ctx.service.loadPage(a, 1),
    });
    expect(cacheText()).toContain('Gizli A ilanı');

    await ctx.manager.logout();
    const b = await ctx.signIn(ctx.owners.b);

    expect(
      ctx.queryClient.getQueryCache().findAll({ queryKey: offersKeyPrefix }),
    ).toHaveLength(0);
    expect(ctx.queryClient.getQueryData(offersListKey(b))).toBeUndefined();
    const listB = await ctx.service.loadPage(b, 1);
    expect(JSON.stringify(listB)).not.toContain('Gizli A ilanı');
    unbind();
  });

  it('a late LIST answer started before sign-out is dropped', async () => {
    const a = await ctx.signIn(ctx.owners.a);
    await ctx.service.create(
      a,
      offerRequest(BRANCH_A, { title: 'Gizli A ilanı' }),
    );
    ctx.offersApi.hold();

    const late = ctx.service.loadPage(a, 1).then(
      () => 'resolved',
      (e: unknown) => (e instanceof OfferLoadError ? e.reason : 'other'),
    );
    await vi.waitFor(() => expect(ctx.offersApi.calls.list).toBe(1));
    await ctx.manager.logout();
    await ctx.signIn(ctx.owners.b);
    ctx.offersApi.release();

    expect(await late).toBe('stale');
    unbind();
  });

  it("a late CREATE result after sign-out and another sign-in is dropped, and writes nothing into the new user's cache", async () => {
    const a = await ctx.signIn(ctx.owners.a);
    ctx.offersApi.hold();
    const pending = ctx.service.create(
      a,
      offerRequest(BRANCH_A, { title: 'Geç gelen' }),
    );
    await vi.waitFor(() => expect(ctx.offersApi.calls.create).toBe(1));

    await ctx.manager.logout();
    const b = await ctx.signIn(ctx.owners.b);
    ctx.offersApi.release();
    const outcome = await pending;

    expect(outcome).toEqual({ kind: 'stale' }); // never "ok": it is not B's result
    applyWriteOutcome(ctx.queryClient, ctx.manager, a, outcome);
    expect(cacheText()).not.toContain('Geç gelen');
    expect(ctx.queryClient.getQueryData(offersListKey(b))).toBeUndefined();
    // The server did create A's draft (the answer was only late): it belongs to A alone.
    expect(ctx.offersApi.executed.create).toBe(1);
    expect((await ctx.service.loadPage(b, 1)).items).toEqual([]);
    unbind();
  });

  it('a late PUBLISH result is dropped too', async () => {
    const a = await ctx.signIn(ctx.owners.a);
    const created = await ctx.service.create(a, offerRequest(BRANCH_A));
    if (created.kind !== 'ok') throw new Error('draft expected');
    ctx.offersApi.hold();
    const pending = ctx.service.publish(a, created.offer.id);
    await vi.waitFor(() => expect(ctx.offersApi.calls.publish).toBe(1));

    await ctx.manager.logout();
    await ctx.signIn(ctx.owners.b);
    ctx.offersApi.release();

    expect(await pending).toEqual({ kind: 'stale' });
    unbind();
  });

  it('a write finishing after sign-out is dropped even before anyone signs in again', async () => {
    const a = await ctx.signIn(ctx.owners.a);
    ctx.offersApi.hold();
    const pending = ctx.service.create(a, offerRequest(BRANCH_A));
    await vi.waitFor(() => expect(ctx.offersApi.calls.create).toBe(1));
    await ctx.manager.logout();
    ctx.offersApi.release();
    expect((await pending).kind).toBe('stale');
    unbind();
  });

  describe('applyWriteOutcome', () => {
    it('puts a successful result into the detail cache and invalidates the list, for the same user only', async () => {
      const a = await ctx.signIn(ctx.owners.a);
      await ctx.queryClient.fetchQuery({
        queryKey: offersListKey(a),
        queryFn: () => ctx.service.loadPage(a, 1),
      });
      const created = await ctx.service.create(a, offerRequest(BRANCH_A));
      if (created.kind !== 'ok') throw new Error('draft expected');

      applyWriteOutcome(ctx.queryClient, ctx.manager, a, created);

      expect(
        ctx.queryClient.getQueryData(offerDetailKey(a, created.offer.id)),
      ).toMatchObject({ id: created.offer.id });
      expect(
        ctx.queryClient.getQueryState(offersListKey(a))?.isInvalidated,
      ).toBe(true);
      unbind();
    });

    it('does nothing for a result that is not "ok" or for another user', async () => {
      const a = await ctx.signIn(ctx.owners.a);
      const created = await ctx.service.create(a, offerRequest(BRANCH_A));
      if (created.kind !== 'ok') throw new Error('draft expected');

      applyWriteOutcome(ctx.queryClient, ctx.manager, a, { kind: 'unknown' });
      applyWriteOutcome(ctx.queryClient, ctx.manager, 'someone-else', created);

      expect(ctx.queryClient.getQueryCache().getAll()).toHaveLength(0);
      unbind();
    });
  });

  it('keeps the query keys user-bound', () => {
    expect(offersUserKey('u1')).toEqual(['offers', 'mine', 'u1']);
    expect(offerDetailKey('u1', 'o1')).toEqual([
      'offers',
      'mine',
      'u1',
      'detail',
      'o1',
    ]);
    expect(offersListKey('u1')).not.toEqual(offersListKey('u2'));
  });
});
