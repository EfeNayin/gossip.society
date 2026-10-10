import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { apiMe } from './api';
import { cookieNames } from './cookies';
import { isSecureEnvironment } from './config';
import { classifyMe, type AdminSession } from './session-state';

// Set by proxy.ts only (and always removed from incoming requests there), to
// tell the page that the proxy could not renew the tokens because the API was
// unreachable.
export const AUTH_STATE_HEADER = 'x-gs-auth-state';

/**
 * Data-access layer for the panel: asks the API who the cookie's access token
 * belongs to. Call it from the code that renders or mutates protected data; the
 * proxy's redirects are only a convenience. Reads cookies, so it must run
 * inside a Suspense boundary. Not cached across requests (React's cache() only
 * dedupes calls within one render).
 */
export const getAdminSession = cache(async (): Promise<AdminSession> => {
  const [cookieStore, requestHeaders] = await Promise.all([
    cookies(),
    headers(),
  ]);

  if (requestHeaders.get(AUTH_STATE_HEADER) === 'unavailable') {
    return { kind: 'unavailable' };
  }

  const accessToken = cookieStore.get(
    cookieNames(isSecureEnvironment()).access,
  )?.value;
  if (!accessToken) return { kind: 'unauthenticated' };

  return classifyMe(await apiMe(accessToken));
});
