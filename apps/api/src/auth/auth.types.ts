import type { SafeUser } from '@gossip/shared';

/** The slice of the HTTP request the guards and decorators read or write. */
export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  // Set by AuthGuard from the database row, never from the token or the client.
  user?: SafeUser;
  // Set by AuthGuard from the verified token, after the session was checked.
  sessionId?: string;
}
