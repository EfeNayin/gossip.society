// Native (iOS/Android): the operating system's secure storage (Keychain /
// Keystore). Never AsyncStorage. The whole session is ONE item, so a write
// either replaces both tokens or neither.
import * as SecureStore from 'expo-secure-store';
import { parseStoredSession, serializeSession } from './stored-session';
import type { StoredSession, TokenStorage } from './types';

const KEY = 'gossip-society.session';

export function createTokenStorage(): TokenStorage {
  return {
    async load() {
      let raw: string | null;
      try {
        raw = await SecureStore.getItemAsync(KEY);
      } catch {
        // Unreadable (e.g. locked keychain): behave as signed out, don't crash.
        return null;
      }
      const session = parseStoredSession(raw);
      // A corrupt or partial value is worthless: remove it.
      if (raw && !session)
        await SecureStore.deleteItemAsync(KEY).catch(() => {});
      return session;
    },
    async save(session: StoredSession) {
      await SecureStore.setItemAsync(KEY, serializeSession(session));
    },
    async clear() {
      await SecureStore.deleteItemAsync(KEY);
    },
  };
}
