import { isAccessTokenUsable } from './jwt-exp';

export type ProxyDecision =
  | { kind: 'pass' }
  | { kind: 'refresh' }
  | { kind: 'redirect'; to: '/login' | '/' };

/**
 * Optimistic routing in the proxy. This only decides where a request goes and
 * whether tokens need renewing; it is not an authorization check. The panel
 * verifies the session with the API on every render.
 */
export function decideProxyAction(input: {
  pathname: string;
  accessToken: string | undefined;
  refreshToken: string | undefined;
  nowMs?: number;
}): ProxyDecision {
  const { pathname, accessToken, refreshToken, nowMs } = input;

  const accessUsable = isAccessTokenUsable(accessToken, nowMs);

  if (pathname === '/login') {
    // Already signed in (or signed in and only needing a refresh): go to the panel.
    return accessUsable || refreshToken
      ? { kind: 'redirect', to: '/' }
      : { kind: 'pass' };
  }

  if (accessUsable) return { kind: 'pass' };
  if (refreshToken) return { kind: 'refresh' };
  return { kind: 'redirect', to: '/login' };
}
