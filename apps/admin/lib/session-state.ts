import type { SafeUser } from '@gossip/shared';
import type { ApiResult } from './api';

export type AdminSession =
  | { kind: 'ok'; user: SafeUser }
  // No usable session (missing, expired, revoked): sign in again.
  | { kind: 'unauthenticated' }
  // A valid session of a user who is not an ADMIN.
  | { kind: 'forbidden' }
  // The account is no longer ACTIVE (pending or suspended).
  | { kind: 'inactive' }
  // The API couldn't be reached or failed: say so, don't end the session.
  | { kind: 'unavailable' };

/**
 * Turns the answer of GET /auth/me into a panel decision. The role and status
 * come from the API's database record for this request, never from a cookie or
 * from anything the browser sent.
 */
export function classifyMe(result: ApiResult<SafeUser>): AdminSession {
  switch (result.kind) {
    case 'unreachable':
      return { kind: 'unavailable' };
    case 'error':
      if (result.status === 401) return { kind: 'unauthenticated' };
      if (result.status === 403 && result.code) return { kind: 'inactive' };
      return { kind: 'unavailable' };
    case 'ok':
      if (result.data.status !== 'ACTIVE') return { kind: 'inactive' };
      if (result.data.role !== 'ADMIN') return { kind: 'forbidden' };
      return { kind: 'ok', user: result.data };
  }
}
