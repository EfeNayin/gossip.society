import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { sessionManager } from './index';
import { useSession } from './use-session';

// Keep the splash screen up until the stored session has been checked.
void SplashScreen.preventAutoHideAsync();

export function SessionProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();

  // On launch: load the stored session and validate it with the API.
  useEffect(() => {
    void sessionManager.start();
  }, []);

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
