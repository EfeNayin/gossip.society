import { createHash } from 'node:crypto';
import type { RefreshOutcome } from './api';

/**
 * Makes sure one refresh token is exchanged at most once.
 *
 * The API revokes a whole session when an already-used refresh token is shown
 * again, and browser cookies are shared by all tabs, so several requests can
 * arrive carrying the same refresh token at once. This coordinator:
 *
 *  - single-flight: concurrent calls for the same token share one API call;
 *  - grace window: for `graceMs` after the exchange, a late request that still
 *    carries the old token (it left the browser before the new cookie was set)
 *    gets the same result instead of being treated as a replay.
 *
 * LIMIT: the state is in this process's memory. It protects a single Node
 * instance only. With several instances behind a load balancer, two instances
 * can still exchange the same token at the same time, which needs sticky
 * routing or a shared lock (e.g. Redis). During the grace window the new
 * tokens are also kept in memory.
 *
 * A temporary failure ("unavailable") is not remembered, so the next request
 * can try again.
 */
export function createRefreshCoordinator(options: {
  refresh: (refreshToken: string) => Promise<RefreshOutcome>;
  graceMs?: number;
}) {
  const graceMs = options.graceMs ?? 15_000;
  const entries = new Map<string, Promise<RefreshOutcome>>();

  return {
    run(refreshToken: string): Promise<RefreshOutcome> {
      // Key by hash so the raw token isn't used as a map key.
      const key = createHash('sha256').update(refreshToken).digest('hex');
      const existing = entries.get(key);
      if (existing) return existing;

      const promise = options.refresh(refreshToken);
      entries.set(key, promise);
      const forget = () => entries.delete(key);
      promise.then((outcome) => {
        if (outcome.kind === 'unavailable') return forget();
        setTimeout(forget, graceMs).unref();
      }, forget);
      return promise;
    },
    /** For tests. */
    size: () => entries.size,
  };
}
