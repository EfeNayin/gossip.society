import type {
  AccountStatusErrorCode,
  OfferErrorCode,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  SafeUser,
} from '@gossip/shared';

export type ApiResult<T> =
  | { kind: 'ok'; data: T }
  | {
      kind: 'error';
      status: number;
      code?: AccountStatusErrorCode;
      // The business-rule code of a 409 from the offer endpoints.
      offerCode?: OfferErrorCode;
    }
  | { kind: 'unreachable' };

/** What the session logic needs from the API (the real one is in api.ts). */
export interface AuthApi {
  login(credentials: LoginRequest): Promise<ApiResult<LoginResponse>>;
  me(accessToken: string): Promise<ApiResult<SafeUser>>;
  refresh(refreshToken: string): Promise<ApiResult<RefreshResponse>>;
  logout(accessToken: string): Promise<ApiResult<void>>;
}

/** Both tokens and their expiry times (ms since epoch), stored as one unit. */
export interface StoredSession {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

export interface TokenStorage {
  /** Returns the stored session, or null if there is none or it is unreadable. */
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

// Why the user is looking at the login screen.
export type Notice =
  'admin-web' | 'expired' | 'inactive' | 'logout' | 'logout-local';

export type SessionStatus =
  | 'loading'
  | 'signedOut'
  | 'signedIn'
  // The API couldn't be reached (or failed): the session is kept.
  | 'unavailable';

export interface SessionSnapshot {
  status: SessionStatus;
  user: SafeUser | null;
  notice: Notice | null;
}

export type LoginResult =
  | { kind: 'ok' }
  | { kind: 'error'; message: string }
  | { kind: 'admin-web' }
  // Another login/logout happened while this one ran; nothing was applied.
  | { kind: 'cancelled' };

export type LogoutResult = 'revoked' | 'already-invalid' | 'failed' | 'none';

/** Result of an authorized API call made through SessionManager.request(). */
export type RequestResult<T> =
  ApiResult<T> | { kind: 'unauthorized' } | { kind: 'cancelled' };
