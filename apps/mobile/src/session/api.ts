// The mobile app's client for the auth endpoints. Nothing here logs request or
// response bodies, so tokens never reach the console.
import {
  accountStatusErrorSchema,
  loginResponseSchema,
  refreshResponseSchema,
  safeUserSchema,
  type AccountStatusErrorCode,
} from '@gossip/shared';
import type { ApiResult, AuthApi } from './types';

const TIMEOUT_MS = 10_000;

export function createAuthApi(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): AuthApi {
  const root = baseUrl.replace(/\/+$/, '');

  async function call<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST';
      token?: string;
      body?: unknown;
      parse: (json: unknown) => T;
    },
  ): Promise<ApiResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          ...(options.body === undefined
            ? {}
            : { 'content-type': 'application/json' }),
          ...(options.token
            ? { authorization: `Bearer ${options.token}` }
            : {}),
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch {
      return { kind: 'unreachable' };
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let code: AccountStatusErrorCode | undefined;
      if (response.status === 403) {
        const parsed = accountStatusErrorSchema.safeParse(
          await response.json().catch(() => undefined),
        );
        if (parsed.success) code = parsed.data.code;
      }
      return { kind: 'error', status: response.status, code };
    }

    try {
      const json: unknown =
        response.status === 204 ? undefined : await response.json();
      return { kind: 'ok', data: options.parse(json) };
    } catch {
      // A success answer that doesn't match the shared contract.
      return { kind: 'error', status: 502 };
    }
  }

  return {
    login: (credentials) =>
      call('/auth/login', {
        method: 'POST',
        body: credentials,
        parse: (json) => loginResponseSchema.parse(json),
      }),
    me: (accessToken) =>
      call('/auth/me', {
        token: accessToken,
        parse: (json) => safeUserSchema.parse(json),
      }),
    refresh: (refreshToken) =>
      call('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        parse: (json) => refreshResponseSchema.parse(json),
      }),
    logout: (accessToken) =>
      call<void>('/auth/logout', {
        method: 'POST',
        token: accessToken,
        parse: () => undefined,
      }),
  };
}
