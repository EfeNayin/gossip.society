import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { sessionManager } from '@/session';
import { useSession } from '@/session/use-session';
import { fetchMyVenues } from './index';
import { myVenuesKey, VenueLoadError } from './venues-query';

/** The signed-in venue owner's own venues. The query is keyed by the user. */
export function useMyVenues() {
  const { status, user } = useSession();
  const userId = status === 'signedIn' ? (user?.id ?? null) : null;

  const query = useQuery({
    queryKey: myVenuesKey(userId ?? 'none'),
    queryFn: () => fetchMyVenues(userId as string),
    enabled: userId !== null && user?.role === 'VENUE_OWNER',
    // The session manager already renews tokens and retries once; a failure
    // is shown with a retry button instead of being repeated silently.
    retry: false,
    staleTime: 30_000,
  });

  const failure =
    query.error instanceof VenueLoadError ? query.error.reason : null;

  // The API refused this account (its role may have changed): ask who the
  // user is now. If the role changed, the navigation follows it.
  useEffect(() => {
    if (failure === 'forbidden') void sessionManager.validate({ force: true });
  }, [failure]);

  return { query, failure };
}
