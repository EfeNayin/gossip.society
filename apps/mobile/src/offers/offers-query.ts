import type {
  CreateOfferRequest,
  OfferErrorCode,
  OwnerOffer,
  OwnerOfferList,
  UpdateOfferRequest,
} from '@gossip/shared';
import type { SessionManager } from '@/session/session-manager';
import type { ApiResult } from '@/session/types';
import type { OffersApi } from './offers-api';

// Every offer query lives under ['offers', 'mine', <user id>, ...]: the user id
// is part of the key, so one user's data can never be read through another's.
export const offersKeyPrefix = ['offers'] as const;
export const offersUserKey = (userId: string) =>
  ['offers', 'mine', userId] as const;
export const offersListKey = (userId: string) =>
  [...offersUserKey(userId), 'list'] as const;
export const offerDetailKey = (userId: string, id: string) =>
  [...offersUserKey(userId), 'detail', id] as const;

export type OfferLoadFailure =
  | 'unreachable'
  | 'unexpected'
  | 'forbidden'
  | 'not-found'
  // The session ended; the session manager already moved the app to login.
  | 'ended'
  // The answer belongs to a session that is gone or to another user: dropped.
  | 'stale';

export class OfferLoadError extends Error {
  constructor(readonly reason: OfferLoadFailure) {
    super(`Offers could not be loaded: ${reason}`);
  }
}

/** The result of create / edit / publish. */
export type WriteOutcome =
  | { kind: 'ok'; offer: OwnerOffer }
  // A business rule refused it (subscription, quota, not a draft, expired).
  | { kind: 'conflict'; code: OfferErrorCode }
  | { kind: 'not-found' }
  | { kind: 'invalid' }
  | { kind: 'forbidden' }
  // The answer was lost, or the server failed: we DON'T know whether it
  // happened. Never turned into "failed", never retried automatically.
  | { kind: 'unknown' }
  | { kind: 'ended' }
  | { kind: 'stale' };

type Deps = {
  manager: Pick<SessionManager, 'request' | 'getSnapshot'>;
  api: OffersApi;
};

/**
 * All offer calls go through SessionManager.request(): token renewal, the
 * one-retry rule and session ending are the manager's. That retry only follows
 * a 401, which the API answers before it runs anything, so a write that got a
 * 401 was not executed and repeating it can't create a duplicate. A network
 * error, a timeout or a 5xx is NEVER retried here.
 */
export function createOffersService({ manager, api }: Deps) {
  const sameUser = (userId: string) =>
    manager.getSnapshot().user?.id === userId;

  async function read<T>(
    userId: string,
    call: (token: string) => Promise<ApiResult<T>>,
  ): Promise<T> {
    const result = await manager.request(call);
    if (result.kind === 'unauthorized') throw new OfferLoadError('ended');
    if (result.kind === 'cancelled') throw new OfferLoadError('stale');
    if (!sameUser(userId)) throw new OfferLoadError('stale');
    switch (result.kind) {
      case 'ok':
        return result.data;
      case 'unreachable':
        throw new OfferLoadError('unreachable');
      case 'error':
        throw new OfferLoadError(
          result.status === 403
            ? 'forbidden'
            : result.status === 404
              ? 'not-found'
              : 'unexpected',
        );
    }
  }

  async function write(
    userId: string,
    call: (token: string) => Promise<ApiResult<OwnerOffer>>,
  ): Promise<WriteOutcome> {
    const result = await manager.request(call);
    if (result.kind === 'unauthorized') return { kind: 'ended' };
    if (result.kind === 'cancelled') return { kind: 'stale' };
    // The user changed while the call was on the wire: the result is not theirs.
    if (!sameUser(userId)) return { kind: 'stale' };
    switch (result.kind) {
      case 'ok':
        return { kind: 'ok', offer: result.data };
      case 'unreachable':
        return { kind: 'unknown' };
      case 'error':
        if (result.status === 409 && result.offerCode)
          return { kind: 'conflict', code: result.offerCode };
        if (result.status === 404) return { kind: 'not-found' };
        if (result.status === 400) return { kind: 'invalid' };
        if (result.status === 403) return { kind: 'forbidden' };
        return { kind: 'unknown' };
    }
  }

  return {
    loadPage: (userId: string, page: number): Promise<OwnerOfferList> =>
      read(userId, (token) => api.list(token, page)),
    loadOffer: (userId: string, id: string): Promise<OwnerOffer> =>
      read(userId, (token) => api.get(token, id)),
    // The same `idempotencyKey` must be used for every repeat of one logical
    // create (a 401 retry inside request() reuses this closure, so it does).
    create: (
      userId: string,
      body: CreateOfferRequest,
      idempotencyKey: string,
    ) => write(userId, (token) => api.create(token, body, idempotencyKey)),
    update: (userId: string, id: string, body: UpdateOfferRequest) =>
      write(userId, (token) => api.update(token, id, body)),
    publish: (userId: string, id: string) =>
      write(userId, (token) => api.publish(token, id)),
  };
}

export type OffersService = ReturnType<typeof createOffersService>;
