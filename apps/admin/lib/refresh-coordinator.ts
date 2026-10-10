import { createHash } from 'node:crypto';
import { apiRefresh, type RefreshOutcome } from './api';

export type CoordinatedOutcome = RefreshOutcome | { kind: 'ended' };

// One "lineage" per login: every refresh token a session has had belongs to it.
// Ending it (logout) makes all of them unusable for this coordinator, including
// results that are cached or still being fetched.
interface Lineage {
  ended: boolean;
}

interface Entry {
  lineage: Lineage;
  result?: Promise<RefreshOutcome>;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Makes sure one refresh token is exchanged at most once, and that a session
 * that was ended here is never brought back by a refresh result.
 *
 * The API revokes a whole session when an already-used refresh token is shown
 * again, and browser cookies are shared by all tabs, so several requests can
 * arrive carrying the same refresh token at once. This coordinator:
 *
 *  - single-flight: concurrent calls for the same token share one API call;
 *  - grace window: for `graceMs` after the exchange, a late request that still
 *    carries the old token (it left the browser before the new cookie was set)
 *    gets the same result instead of being treated as a replay;
 *  - end(): logout marks the session's lineage as ended. From then on `run()`
 *    answers `ended` for every token of that session, also for a refresh that
 *    was already in flight or whose result is cached, so a stale result can
 *    never write cookies again (and can't overwrite a newer login's cookies).
 *
 * Callers must check `isEnded()` again in the same synchronous step in which
 * they write cookies: that check-then-write is what guarantees the ordering.
 *
 * LIMIT: the state is in this process's memory. It protects a single Node
 * instance only. With several instances behind a load balancer, two instances
 * can still exchange the same token at the same time, or one instance can
 * miss a logout done on another; that needs sticky routing or a shared store
 * (e.g. Redis). During the grace window the new tokens are also kept in memory.
 * What a response already sent to the browser carried can't be taken back: if
 * it reaches the browser after the logout's response, the cookies it sets are
 * for a session that is already revoked on the server and are removed at the
 * next request.
 *
 * A temporary failure ("unavailable") is not remembered, so the next request
 * can try again.
 */
export function createRefreshCoordinator(options: {
  refresh: (refreshToken: string) => Promise<RefreshOutcome>;
  graceMs?: number;
  // How long an ended session is remembered. After that a stale token goes to
  // the API, which refuses it because the session was revoked.
  endedRetentionMs?: number;
}) {
  const graceMs = options.graceMs ?? 15_000;
  const endedRetentionMs = options.endedRetentionMs ?? 10 * 60_000;
  const entries = new Map<string, Entry>();

  // Key by hash so raw tokens aren't used as map keys.
  const keyOf = (token: string) =>
    createHash('sha256').update(token).digest('hex');

  const schedule = (key: string, entry: Entry, ms: number) => {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      if (entries.get(key) === entry) entries.delete(key);
    }, ms);
    entry.timer.unref();
  };

  // An ended lineage keeps its entries until the retention timer says so.
  const forget = (key: string, entry: Entry) => {
    if (entry.lineage.ended) return;
    clearTimeout(entry.timer);
    if (entries.get(key) === entry) entries.delete(key);
  };

  return {
    run(refreshToken: string): Promise<CoordinatedOutcome> {
      const key = keyOf(refreshToken);
      const existing = entries.get(key);
      if (existing?.lineage.ended) return Promise.resolve({ kind: 'ended' });

      // In flight or cached: share it, but re-check when the caller continues.
      if (existing?.result) {
        const { lineage } = existing;
        return existing.result.then((outcome) =>
          lineage.ended ? { kind: 'ended' } : outcome,
        );
      }

      // A known token that hasn't been exchanged yet (the alias of a previous
      // refresh's new token) keeps its lineage; a new one starts its own.
      const entry: Entry = existing ?? { lineage: { ended: false } };
      entries.set(key, entry);
      const { lineage } = entry;

      const result = options.refresh(refreshToken).then(
        (outcome) => {
          if (outcome.kind === 'ok') {
            // The new token belongs to the same session, so ending the session
            // by either token reaches this lineage.
            const newKey = keyOf(outcome.tokens.refreshToken);
            const alias: Entry = { lineage };
            entries.set(newKey, alias);
            schedule(newKey, alias, graceMs);
          }
          if (outcome.kind === 'unavailable') forget(key, entry);
          else if (!lineage.ended) schedule(key, entry, graceMs);
          return outcome;
        },
        (error: unknown) => {
          forget(key, entry);
          throw error;
        },
      );
      entry.result = result;
      return result.then((outcome) =>
        lineage.ended ? { kind: 'ended' } : outcome,
      );
    },

    /** Ends the session this refresh token belongs to (logout). */
    end(refreshToken: string): void {
      const key = keyOf(refreshToken);
      const entry = entries.get(key) ?? { lineage: { ended: false } };
      entry.lineage.ended = true;
      entries.set(key, entry);
      schedule(key, entry, endedRetentionMs);
    },

    isEnded(refreshToken: string): boolean {
      return entries.get(keyOf(refreshToken))?.lineage.ended ?? false;
    },

    /** For tests. */
    size: () => entries.size,
  };
}

export type RefreshCoordinator = ReturnType<typeof createRefreshCoordinator>;

// The proxy and the Server Actions are bundled separately by Next.js, so a
// module-level variable would give each its own copy (verified on a production
// build: different module instances in the same process). globalThis is shared
// by both, so the coordinator is kept there.
const GLOBAL_KEY = Symbol.for('gossip-society.admin.refresh-coordinator');

export function getRefreshCoordinator(): RefreshCoordinator {
  const store = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: RefreshCoordinator;
  };
  return (store[GLOBAL_KEY] ??= createRefreshCoordinator({
    refresh: apiRefresh,
  }));
}
