import type { MyVenuesResponse } from '@gossip/shared';
import type { QueryClient } from '@tanstack/react-query';
import { bindUserCacheToSession } from '@/session/bind-user-cache';
import type { SessionManager } from '@/session/session-manager';
import type { VenuesApi } from './venues-api';

// Every venue query lives under ['venues']; the user id is part of the key, so
// one user's data can never be read through another user's key.
export const venuesKeyPrefix = ['venues'] as const;
export const myVenuesKey = (userId: string) =>
  ['venues', 'mine', userId] as const;

export type VenueLoadFailure =
  // The API can't be reached (offline, timeout).
  | 'unreachable'
  // Server error, rate limit, or an answer that doesn't match the shared contract.
  | 'unexpected'
  // The API says this account may not read this (e.g. its role changed).
  | 'forbidden'
  // The session ended (expired, revoked, account inactive): the session manager
  // already moved the app to the login screen. NOT a connection problem.
  | 'ended'
  // The answer belongs to a session that is gone or to another user: dropped.
  | 'stale';

export class VenueLoadError extends Error {
  constructor(readonly reason: VenueLoadFailure) {
    super(`Venues could not be loaded: ${reason}`);
  }
}

/**
 * Reads the signed-in owner's venues through SessionManager.request(), so
 * token renewal, the one-retry rule and session ending are the manager's.
 */
export function createMyVenuesFetcher(deps: {
  manager: Pick<SessionManager, 'request' | 'getSnapshot'>;
  api: VenuesApi;
}) {
  return async function fetchMyVenues(
    userId: string,
  ): Promise<MyVenuesResponse> {
    const result = await deps.manager.request((token) =>
      deps.api.myVenues(token),
    );

    // The session manager ended the session for this very request.
    if (result.kind === 'unauthorized') throw new VenueLoadError('ended');
    // The session changed while the call was on the wire: not ours any more.
    if (result.kind === 'cancelled') throw new VenueLoadError('stale');

    // Belt and braces: whoever is signed in now must be the user this request
    // was made for.
    if (deps.manager.getSnapshot().user?.id !== userId) {
      throw new VenueLoadError('stale');
    }

    switch (result.kind) {
      case 'ok':
        return result.data;
      case 'unreachable':
        throw new VenueLoadError('unreachable');
      case 'error':
        throw new VenueLoadError(
          result.status === 403 ? 'forbidden' : 'unexpected',
        );
    }
  };
}

/** Removes the venue queries when the user changes or signs out. */
export function bindVenueCacheToSession(
  manager: Pick<SessionManager, 'subscribe' | 'getSnapshot'>,
  queryClient: QueryClient,
): () => void {
  return bindUserCacheToSession(manager, queryClient, [venuesKeyPrefix]);
}
