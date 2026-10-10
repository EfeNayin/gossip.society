// Server-side client for the Gossip Society API. Only the Next.js server calls
// it; tokens come from, and go back into, HttpOnly cookies and never reach the
// browser. Nothing here logs request or response bodies.
import {
  accountStatusErrorSchema,
  adminVenueListSchema,
  createVenueResponseSchema,
  emailConflictErrorSchema,
  healthResponseSchema,
  loginResponseSchema,
  refreshResponseSchema,
  safeUserSchema,
  type AccountStatusErrorCode,
  type AdminVenue,
  type AdminVenueList,
  type CreateVenueRequest,
  type HealthResponse,
  type LoginRequest,
  type LoginResponse,
  type SafeUser,
  type VenueErrorCode,
} from '@gossip/shared';
import { getApiUrl } from './config';
import type { SessionTokens } from './cookies';

export type ApiResult<T> =
  | { kind: 'ok'; data: T }
  | {
      kind: 'error';
      status: number;
      code?: AccountStatusErrorCode;
      // 409 of POST /admin/venues.
      venueCode?: VenueErrorCode;
    }
  | { kind: 'unreachable' };

const TIMEOUT_MS = 8000;

async function call<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    token?: string;
    body?: unknown;
    parse: (json: unknown) => T;
  },
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body === undefined
          ? {}
          : { 'content-type': 'application/json' }),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      // Responses belong to one user's session: never cache them.
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { kind: 'unreachable' };
  }

  if (!response.ok) {
    let code: AccountStatusErrorCode | undefined;
    let venueCode: VenueErrorCode | undefined;
    if (response.status === 409) {
      const parsed = emailConflictErrorSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      if (parsed.success) venueCode = parsed.data.code;
    }
    if (response.status === 403) {
      const parsed = accountStatusErrorSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      if (parsed.success) code = parsed.data.code;
    }
    return { kind: 'error', status: response.status, code, venueCode };
  }

  try {
    const json: unknown =
      response.status === 204 ? undefined : await response.json();
    return { kind: 'ok', data: options.parse(json) };
  } catch {
    // 200 with a body that doesn't match the shared contract.
    return { kind: 'error', status: 502 };
  }
}

export const apiLogin = (credentials: LoginRequest) =>
  call<LoginResponse>('/auth/login', {
    method: 'POST',
    body: credentials,
    parse: (json) => loginResponseSchema.parse(json),
  });

export const apiMe = (accessToken: string) =>
  call<SafeUser>('/auth/me', {
    token: accessToken,
    parse: (json) => safeUserSchema.parse(json),
  });

export const apiLogout = (accessToken: string) =>
  call<void>('/auth/logout', {
    method: 'POST',
    token: accessToken,
    parse: () => undefined,
  });

export const apiHealth = () =>
  call<HealthResponse>('/health', {
    parse: (json) => healthResponseSchema.parse(json),
  });

export const apiListVenues = (
  accessToken: string,
  { page, pageSize }: { page: number; pageSize: number },
) =>
  call<AdminVenueList>(`/admin/venues?page=${page}&pageSize=${pageSize}`, {
    token: accessToken,
    parse: (json) => adminVenueListSchema.parse(json),
  });

// The request carries the initial password to the API (server to server) and
// is not retried or logged here: if the answer is lost the caller can't know
// whether the venue was created.
export const apiCreateVenue = (
  accessToken: string,
  request: CreateVenueRequest,
) =>
  call<AdminVenue>('/admin/venues', {
    method: 'POST',
    token: accessToken,
    body: request,
    parse: (json) => createVenueResponseSchema.parse(json),
  });

export type RefreshOutcome =
  | { kind: 'ok'; tokens: SessionTokens }
  // The API refused the token (unknown, used, expired, revoked, or the account
  // is not ACTIVE): the session is over.
  | { kind: 'rejected' }
  // Network error, 429 or 5xx: the session may still be fine, so keep cookies.
  | { kind: 'unavailable' };

export async function apiRefresh(
  refreshToken: string,
): Promise<RefreshOutcome> {
  const result = await call('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    parse: (json) => refreshResponseSchema.parse(json),
  });
  if (result.kind === 'ok') {
    const {
      accessToken,
      accessTokenExpiresAt,
      refreshToken: next,
      refreshTokenExpiresAt,
    } = result.data;
    return {
      kind: 'ok',
      tokens: {
        accessToken,
        accessTokenExpiresAt,
        refreshToken: next,
        refreshTokenExpiresAt,
      },
    };
  }
  if (
    result.kind === 'error' &&
    (result.status === 401 || result.status === 403)
  ) {
    return { kind: 'rejected' };
  }
  return { kind: 'unavailable' };
}
