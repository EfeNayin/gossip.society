import { cache } from 'react';
import { cookies } from 'next/headers';
import type { SafeUser } from '@gossip/shared';
import { isSecureEnvironment } from './config';
import { cookieNames } from './cookies';
import { getAdminSession } from './session';

export type AdminContext =
  // An ACTIVE ADMIN, verified by the API for this request, plus the access
  // token to call the admin endpoints with (they check the role again).
  | { kind: 'ok'; user: SafeUser; accessToken: string }
  // The API can't be reached: say so, keep the session.
  | { kind: 'unavailable' }
  // No usable admin session: the caller sends the visitor to /session/end.
  | { kind: 'end' };

/**
 * Every admin page and action starts here, so that every read and every change
 * is authorized on the server for that very request (not by a client redirect).
 */
export const getAdminContext = cache(async (): Promise<AdminContext> => {
  const session = await getAdminSession();
  if (session.kind === 'unavailable') return { kind: 'unavailable' };
  if (session.kind !== 'ok') return { kind: 'end' };

  const accessToken = (await cookies()).get(
    cookieNames(isSecureEnvironment()).access,
  )?.value;
  return accessToken
    ? { kind: 'ok', user: session.user, accessToken }
    : { kind: 'end' };
});
