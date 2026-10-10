import * as SplashScreen from 'expo-splash-screen';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { offersKeyPrefix } from '@/offers/offers-query';
import { venuesKeyPrefix } from '@/venues/venues-query';
import { bindUserCacheToSession } from './bind-user-cache';
import { sessionManager } from './index';
import { useSession } from './use-session';

// Keep the splash screen up until the stored session has been checked.
void SplashScreen.preventAutoHideAsync();

export function SessionProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const queryClient = useQueryClient();

  // On launch: load the stored session and validate it with the API.
  useEffect(() => {
    void sessionManager.start();
  }, []);

  // Venue and offer data belong to the signed-in user: drop it when the user changes
  // or signs out.
  useEffect(
    () =>
      bindUserCacheToSession(sessionManager, queryClient, [
        venuesKeyPrefix,
        offersKeyPrefix,
      ]),
    [queryClient],
  );

  // Back from the background: check again (rate-limited inside the manager).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sessionManager.validate();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  return children;
}
