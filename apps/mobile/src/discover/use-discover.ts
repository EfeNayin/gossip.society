import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { sessionManager } from '@/session';
import { useSession } from '@/session/use-session';
import { discoverService } from './index';
import {
  DiscoverLoadError,
  discoverDetailKey,
  discoverListKey,
  type DiscoverLoadFailure,
} from './discover-query';

// The signed-in influencer's id, or null. Every query is keyed by it and only
// enabled for an influencer; the API checks the role (and ACTIVE) again.
function useInfluencerId(): string | null {
  const { status, user } = useSession();
  return status === 'signedIn' && user?.role === 'INFLUENCER' ? user.id : null;
}

// How long a loaded list counts as current.
export const DISCOVER_STALE_MS = 15_000;

function failureOf(error: unknown): DiscoverLoadFailure | null {
  return error instanceof DiscoverLoadError ? error.reason : null;
}

// The API refused this account (its role may have changed): ask who the user is
// now. If the role changed, the navigation follows it.
function useRevalidateOnForbidden(failure: DiscoverLoadFailure | null) {
  useEffect(() => {
    if (failure === 'forbidden') void sessionManager.validate({ force: true });
  }, [failure]);
}

export function useDiscoverList() {
  const userId = useInfluencerId();
  const query = useInfiniteQuery({
    queryKey: discoverListKey(userId ?? 'none'),
    queryFn: ({ pageParam }) =>
      discoverService.loadPage(userId as string, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
    enabled: userId !== null,
    // The session manager already renews tokens and retries once after a 401; a
    // failure is shown with a retry button instead of being repeated silently.
    retry: false,
    staleTime: DISCOVER_STALE_MS,
  });
  const failure = failureOf(query.error);
  useRevalidateOnForbidden(failure);
  const offers = query.data?.pages.flatMap((page) => page.items);
  return { query, failure, offers };
}

/**
 * One offer. It is ALWAYS asked from the API when the screen opens (no cache
 * time, nothing seeded from the list): an offer that was suspended or ended
 * after the list was read must not be shown as if it were still open. If a
 * later refresh says it is not visible any more, the page shows that and the
 * list is refreshed too.
 */
export function useDiscoverOffer(id: string) {
  const userId = useInfluencerId();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: discoverDetailKey(userId ?? 'none', id),
    queryFn: () => discoverService.loadOffer(userId as string, id),
    enabled: userId !== null,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
  const failure = failureOf(query.error);
  useRevalidateOnForbidden(failure);

  useEffect(() => {
    if (failure === 'not-found' && userId)
      void queryClient.invalidateQueries({ queryKey: discoverListKey(userId) });
  }, [failure, userId, queryClient]);

  return { query, failure };
}
