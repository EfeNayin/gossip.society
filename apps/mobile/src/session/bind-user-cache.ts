import type { QueryClient } from '@tanstack/react-query';
import type { SessionManager } from './session-manager';

/**
 * Removes every cached query under the given key prefixes when the signed-in
 * user changes or signs out, so one user's data is gone before anyone else
 * can see it. Queries still on the wire are cancelled first. Returns the
 * unsubscribe function.
 */
export function bindUserCacheToSession(
  manager: Pick<SessionManager, 'subscribe' | 'getSnapshot'>,
  queryClient: QueryClient,
  prefixes: readonly (readonly string[])[],
): () => void {
  let userId = manager.getSnapshot().user?.id ?? null;
  return manager.subscribe(() => {
    const next = manager.getSnapshot().user?.id ?? null;
    if (next === userId) return;
    userId = next;
    for (const prefix of prefixes) {
      void queryClient.cancelQueries({ queryKey: prefix });
      queryClient.removeQueries({ queryKey: prefix });
    }
  });
}
