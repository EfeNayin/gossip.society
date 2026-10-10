// Web preview: SecureStore doesn't exist on web, and localStorage /
// sessionStorage must not hold tokens. The session lives in memory only, so a
// page reload means signing in again. (Persistent web sessions are a separate task.)
import type { StoredSession, TokenStorage } from './types';

export function createTokenStorage(): TokenStorage {
  let session: StoredSession | null = null;
  return {
    async load() {
      return session;
    },
    async save(next) {
      session = next;
    },
    async clear() {
      session = null;
    },
  };
}
