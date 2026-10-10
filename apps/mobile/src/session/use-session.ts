import { useSyncExternalStore } from 'react';
import { sessionManager } from './index';
import type { SessionSnapshot } from './types';

export function useSession(): SessionSnapshot {
  return useSyncExternalStore(
    sessionManager.subscribe,
    sessionManager.getSnapshot,
    sessionManager.getSnapshot,
  );
}
