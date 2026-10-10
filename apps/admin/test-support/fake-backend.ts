import type { SafeUser } from '@gossip/shared';
import type * as api from '@/lib/api';
import { apiMocks } from './api-mock';

export const accessJwt = (expiresInSeconds: number) =>
  `h.${Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
  ).toString('base64url')}.${Math.random().toString(36).slice(2)}`;

export const adminUser: SafeUser = {
  id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a11',
  email: 'admin@gossip-society.example',
  name: 'Dev Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
};

interface Session {
  user: SafeUser;
  revoked: boolean;
  refreshToken: string;
  usedRefreshTokens: Set<string>;
  accessTokens: Set<string>;
}

/**
 * In-memory stand-in for the API's session rules (the real ones are covered by
 * the API's own tests): refresh rotates the token, a used token revokes the
 * session, a revoked session refuses refresh, /auth/me and logout.
 */
export class FakeBackend {
  sessions: Session[] = [];
  calls = { refresh: 0, logout: 0, me: 0 };
  // Lets a test hold a refresh "on the wire" and release it later.
  refreshGate?: Promise<void>;
  private counter = 0;

  login(user: SafeUser = adminUser) {
    const n = ++this.counter;
    const session: Session = {
      user,
      revoked: false,
      refreshToken: `rt-${n}-0`,
      usedRefreshTokens: new Set(),
      accessTokens: new Set(),
    };
    const accessToken = accessJwt(900);
    session.accessTokens.add(accessToken);
    this.sessions.push(session);
    return { session, accessToken, refreshToken: session.refreshToken };
  }

  private findByRefresh(token: string) {
    return this.sessions.find(
      (s) => s.refreshToken === token || s.usedRefreshTokens.has(token),
    );
  }
  private findByAccess(token: string) {
    return this.sessions.find((s) => s.accessTokens.has(token));
  }

  install() {
    apiMocks.apiRefresh.mockReset().mockImplementation(async (token) => {
      this.calls.refresh++;
      // The API handles the request now; only the answer is held back.
      const session = this.findByRefresh(token);
      let outcome: api.RefreshOutcome;
      if (!session || session.revoked) outcome = { kind: 'rejected' };
      else if (session.usedRefreshTokens.has(token)) {
        session.revoked = true; // replay
        outcome = { kind: 'rejected' };
      } else {
        session.usedRefreshTokens.add(token);
        session.refreshToken = `${token.replace(/-\d+$/, '')}-${session.usedRefreshTokens.size}`;
        const accessToken = accessJwt(900);
        session.accessTokens.add(accessToken);
        outcome = {
          kind: 'ok',
          tokens: {
            accessToken,
            accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
            refreshToken: session.refreshToken,
            refreshTokenExpiresAt: new Date(
              Date.now() + 7 * 864e5,
            ).toISOString(),
          },
        };
      }
      await this.refreshGate;
      return outcome;
    });
    apiMocks.apiLogout.mockReset().mockImplementation(async (token) => {
      this.calls.logout++;
      const session = this.findByAccess(token);
      if (!session || session.revoked) return { kind: 'error', status: 401 };
      session.revoked = true;
      return { kind: 'ok', data: undefined };
    });
    apiMocks.apiMe.mockReset().mockImplementation(async (token) => {
      this.calls.me++;
      const session = this.findByAccess(token);
      if (!session || session.revoked) return { kind: 'error', status: 401 };
      return { kind: 'ok', data: session.user };
    });
    apiMocks.apiLogin.mockReset().mockImplementation(async () => {
      const { session, accessToken, refreshToken } = this.login();
      return {
        kind: 'ok',
        data: {
          accessToken,
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          refreshToken,
          refreshTokenExpiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
          user: session.user,
        },
      };
    });
    return this;
  }

  holdRefreshes() {
    let release!: () => void;
    this.refreshGate = new Promise<void>((resolve) => (release = resolve));
    return () => {
      this.refreshGate = undefined;
      release();
    };
  }
}
