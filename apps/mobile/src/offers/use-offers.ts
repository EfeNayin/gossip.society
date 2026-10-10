import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sessionManager } from '@/session';
import { useSession } from '@/session/use-session';
import { offersService } from './index';
import { applyWriteOutcome } from './offers-cache';
import {
  OfferLoadError,
  offerDetailKey,
  offersListKey,
  offersUserKey,
  type OfferLoadFailure,
  type WriteOutcome,
} from './offers-query';

// The signed-in owner's id, or null. Every query below is keyed by it and is
// only enabled for a venue owner; the API checks the role again on each call.
function useOwnerId(): string | null {
  const { status, user } = useSession();
  return status === 'signedIn' && user?.role === 'VENUE_OWNER' ? user.id : null;
}

function failureOf(error: unknown): OfferLoadFailure | null {
  return error instanceof OfferLoadError ? error.reason : null;
}

// The API refused this account (its role may have changed): ask who the user
// is now. If the role changed, the navigation follows it.
function useRevalidateOnForbidden(failure: OfferLoadFailure | null) {
  useEffect(() => {
    if (failure === 'forbidden') void sessionManager.validate({ force: true });
  }, [failure]);
}

export function useOffersList() {
  const userId = useOwnerId();
  const query = useInfiniteQuery({
    queryKey: offersListKey(userId ?? 'none'),
    queryFn: ({ pageParam }) =>
      offersService.loadPage(userId as string, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
    enabled: userId !== null,
    // The session manager already renews tokens and retries once; a failure is
    // shown with a retry button instead of being repeated silently.
    retry: false,
    staleTime: 15_000,
  });
  const failure = failureOf(query.error);
  useRevalidateOnForbidden(failure);
  const offers = query.data?.pages.flatMap((page) => page.items);
  return { query, failure, offers };
}

export function useOffer(id: string) {
  const userId = useOwnerId();
  const query = useQuery({
    queryKey: offerDetailKey(userId ?? 'none', id),
    queryFn: () => offersService.loadOffer(userId as string, id),
    enabled: userId !== null,
    retry: false,
    staleTime: 15_000,
  });
  const failure = failureOf(query.error);
  useRevalidateOnForbidden(failure);
  return { query, failure };
}

/**
 * Runs one write at a time. A second press while one is on the wire does
 * nothing (the ref blocks it at once, before React re-renders the disabled
 * button). The result is applied to the cache only for the user who started
 * it. When the outcome is unknown the offers are read again: a GET is safe, and
 * it shows what the server really holds.
 */
export function useOfferWrite() {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (call: (userId: string) => Promise<WriteOutcome>) => {
      const userId = sessionManager.getSnapshot().user?.id;
      if (inFlight.current || !userId) return null;
      inFlight.current = true;
      setBusy(true);
      try {
        const outcome = await call(userId);
        applyWriteOutcome(queryClient, sessionManager, userId, outcome);
        if (outcome.kind === 'forbidden')
          void sessionManager.validate({ force: true });
        if (
          outcome.kind === 'unknown' &&
          sessionManager.getSnapshot().user?.id === userId
        )
          void queryClient.invalidateQueries({
            queryKey: offersUserKey(userId),
          });
        return outcome;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [queryClient],
  );

  return { busy, run };
}
