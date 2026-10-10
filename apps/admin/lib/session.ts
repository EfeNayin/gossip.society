import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { apiMe } from './api';
import { AUTH_STATE, AUTH_STATE_HEADER } from './auth-state';
import { cookieNames } from './cookies';
import { isSecureEnvironment } from './config';
import { classifyMe, type AdminSession } from './session-state';

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

  // Set by proxy.ts only (it strips any client-sent copy).
  const authState = requestHeaders.get(AUTH_STATE_HEADER);
  if (authState === AUTH_STATE.unavailable) return { kind: 'unavailable' };
  // The proxy found no usable session for this request's tokens (refresh
  // refused or session ended). Don't trust whatever cookies it carried.
  if (authState === AUTH_STATE.none) return { kind: 'unauthenticated' };

  const accessToken = cookieStore.get(
    cookieNames(isSecureEnvironment()).access,
  )?.value;
  if (!accessToken) return { kind: 'unauthenticated' };

  return classifyMe(await apiMe(accessToken));
});
