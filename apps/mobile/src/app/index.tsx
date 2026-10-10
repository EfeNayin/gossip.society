import { Redirect } from 'expo-router';
import { routes } from '@/routes';
import { useSession } from '@/session/use-session';

// Sends the visitor to the right screen for the session state. While the
// stored session is being checked the splash screen is still showing.
export default function Index() {
  const { status, user } = useSession();

  if (status === 'loading') return null;
  if (status === 'unavailable') return <Redirect href={routes.unavailable} />;
  if (status === 'signedIn' && user) {
    switch (user.role) {
      case 'INFLUENCER':
        return <Redirect href={routes.influencer} />;
      case 'VENUE_OWNER':
        return <Redirect href={routes.venueOwner} />;
      case 'VENUE_STAFF':
        return <Redirect href={routes.staff} />;
    }
  }
  return <Redirect href={routes.login} />;
}
