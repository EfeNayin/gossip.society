import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '@/session/SessionProvider';
import { useSession } from '@/session/use-session';
import { colors } from '@/theme';

const queryClient = new QueryClient();

export const unstable_settings = { anchor: 'index' };

// The guards below only decide which screens can be shown for the current
// session state. They are navigation, not security: the API checks the token
// and the role of every request itself.
function RootNavigator() {
  const { status, user } = useSession();
  const role = status === 'signedIn' ? user?.role : undefined;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'unavailable'}>
        <Stack.Screen name="unavailable" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'INFLUENCER'}>
        <Stack.Screen name="influencer" />
        <Stack.Screen name="discover/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'VENUE_OWNER'}>
        <Stack.Screen name="venue-owner" />
        <Stack.Screen name="offers/index" />
        <Stack.Screen name="offers/new" />
        <Stack.Screen name="offers/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'VENUE_STAFF'}>
        <Stack.Screen name="staff" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </SessionProvider>
    </QueryClientProvider>
  );
}
