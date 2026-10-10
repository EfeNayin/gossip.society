import type { DiscoverOffer, DiscoverOfferList } from '@gossip/shared';
import type { SessionManager } from '@/session/session-manager';
import type { ApiResult } from '@/session/types';
import type { DiscoverApi } from './discover-api';

// Every discovery query lives under ['discover', 'offers', <user id>, ...]: the
// user id is part of the key, so one user's data can never be read through
// another's, and the whole tree is dropped when the signed-in user changes.
export const discoverKeyPrefix = ['discover'] as const;
export const discoverUserKey = (userId: string) =>
  ['discover', 'offers', userId] as const;
export const discoverListKey = (userId: string) =>
  [...discoverUserKey(userId), 'list'] as const;
export const discoverDetailKey = (userId: string, id: string) =>
  [...discoverUserKey(userId), 'detail', id] as const;

export type DiscoverLoadFailure =
  | 'unreachable'
  | 'unexpected'
  // The API refuses this account (its role or status may have changed).
  | 'forbidden'
  // Not visible (any more): hidden, suspended, ended, not started or missing.
  | 'not-found'
  // The session ended; the session manager already moved the app to login.
  | 'ended'
  // The answer belongs to a session that is gone or to another user: dropped.
  | 'stale';

export class DiscoverLoadError extends Error {
  constructor(readonly reason: DiscoverLoadFailure) {
    super(`Offers could not be loaded: ${reason}`);
  }
}

type Deps = {
  manager: Pick<SessionManager, 'request' | 'getSnapshot'>;
  api: DiscoverApi;
};

/**
 * All discovery calls go through SessionManager.request(): token renewal, the
 * one-retry-after-401 rule and session ending are the manager's. A result is
 * handed on only if the signed-in user is still the one it was asked for.
 */
export function createDiscoverService({ manager, api }: Deps) {
  async function read<T>(
    userId: string,
    call: (token: string) => Promise<ApiResult<T>>,
  ): Promise<T> {
    const result = await manager.request(call);
    if (result.kind === 'unauthorized') throw new DiscoverLoadError('ended');
    if (result.kind === 'cancelled') throw new DiscoverLoadError('stale');
    if (manager.getSnapshot().user?.id !== userId)
      throw new DiscoverLoadError('stale');
    switch (result.kind) {
      case 'ok':
        return result.data;
      case 'unreachable':
        throw new DiscoverLoadError('unreachable');
      case 'error':
        throw new DiscoverLoadError(
          result.status === 403
            ? 'forbidden'
            : result.status === 404
              ? 'not-found'
              : 'unexpected',
        );
    }
  }

  return {
    loadPage: (userId: string, page: number): Promise<DiscoverOfferList> =>
      read(userId, (token) => api.list(token, page)),
    loadOffer: (userId: string, id: string): Promise<DiscoverOffer> =>
      read(userId, (token) => api.get(token, id)),
  };
}

export type DiscoverService = ReturnType<typeof createDiscoverService>;
