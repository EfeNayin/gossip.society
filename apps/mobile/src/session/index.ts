import { API_URL } from '@/config';
import { createAuthApi } from './api';
import { SessionManager } from './session-manager';
import { createTokenStorage } from './token-storage';

// One session for the whole app.
export const sessionManager = new SessionManager({
  api: createAuthApi(API_URL),
  storage: createTokenStorage(),
});
