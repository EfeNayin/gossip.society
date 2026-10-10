import type { QueryClient } from '@tanstack/react-query';
import type { SessionManager } from '@/session/session-manager';
import {
  offerDetailKey,
  offersListKey,
  type WriteOutcome,
} from './offers-query';

/**
 * After a successful create / edit / publish: put the fresh offer into the
 * detail query and refresh the list. Skipped when the signed-in user is no
 * longer the one the call was made for (a late result of an old session must
 * not touch the new user's cache).
 */
export function applyWriteOutcome(
  queryClient: QueryClient,
  manager: Pick<SessionManager, 'getSnapshot'>,
  userId: string,
  outcome: WriteOutcome,
): void {
  if (outcome.kind !== 'ok') return;
  if (manager.getSnapshot().user?.id !== userId) return;
  queryClient.setQueryData(
    offerDetailKey(userId, outcome.offer.id),
    outcome.offer,
  );
  void queryClient.invalidateQueries({ queryKey: offersListKey(userId) });
}
