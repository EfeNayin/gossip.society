import type { LoginRequest, SafeUser } from '@gossip/shared';
import type { ApiResult, AuthApi, StoredSession, TokenStorage } from './types';

export const ACCESS_TTL_MS = 15 * 60_000;
export const SESSION_TTL_MS = 7 * 24 * 3600_000;

export class Clock {
  constructor(public ms = Date.UTC(2026, 9, 10, 12, 0, 0)) {}
  now = () => this.ms;
  advance(ms: number) {
    this.ms += ms;
  }
}

const ROLE_IDS: Record<SafeUser['role'], string> = {
  ADMIN: '00000000-0000-4000-8000-000000000001',
  VENUE_OWNER: '00000000-0000-4000-8000-000000000002',
  VENUE_STAFF: '00000000-0000-4000-8000-000000000003',
  INFLUENCER: '00000000-0000-4000-8000-000000000004',
};

export const user = (
  role: SafeUser['role'],
  overrides: Partial<SafeUser> = {},
): SafeUser => ({
  id: ROLE_IDS[role],
  email: `${role.toLowerCase()}@gossip-society.example`,
  name: `Dev ${role}`,
  role,
  status: 'ACTIVE',
  ...overrides,
});

interface ServerSession {
  user: SafeUser;
  revoked: boolean;
  refreshToken: string;
  usedRefreshTokens: Set<string>;
  accessTokens: Set<string>;
  expiresAt: number;
}

/** Holds back an API ANSWER (the API has already handled the request). */
export class Gate {
  private release?: () => void;
  private promise?: Promise<void>;
  hold() {
    this.promise = new Promise<void>((resolve) => (this.release = resolve));
  }
  open() {
    this.release?.();
    this.promise = undefined;
  }
  wait() {
    return this.promise;
  }
}

/**
 * In-memory stand-in for the API's session rules: refresh rotates the token, a
 * used refresh token revokes the session, a revoked session refuses everything.
 */
export class FakeApi implements AuthApi {
  sessions: ServerSession[] = [];
  accounts = new Map<string, { password: string; user: SafeUser }>();
  calls = { login: 0, me: 0, refresh: 0, logout: 0 };
  gates = {
    login: new Gate(),
    refresh: new Gate(),
    logout: new Gate(),
    me: new Gate(),
  };
  // Force an outcome for the next call(s) of a method.
  forced: Partial<
    Record<'login' | 'me' | 'refresh' | 'logout', ApiResult<never>>
  > = {};
  private counter = 0;

  constructor(private readonly clock: Clock) {}

  addAccount(password: string, account: SafeUser) {
    this.accounts.set(account.email, { password, user: account });
  }

  private token(prefix: string) {
    return `${prefix}-${++this.counter}`;
  }

  private issue(session: ServerSession) {
    const accessToken = this.token('at');
    session.accessTokens.add(accessToken);
    return {
      accessToken,
      accessTokenExpiresAt: new Date(
        this.clock.now() + ACCESS_TTL_MS,
      ).toISOString(),
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  private byAccess(token: string) {
    return this.sessions.find((s) => s.accessTokens.has(token));
  }

  async login(credentials: LoginRequest) {
    this.calls.login++;
    const forced = this.forced.login;
    const account = this.accounts.get(credentials.email);
    let out: ApiResult<never> | undefined = forced;
    if (!out && (!account || account.password !== credentials.password)) {
      out = { kind: 'error', status: 401 };
    }
    if (!out && account && account.user.status !== 'ACTIVE') {
      out = {
        kind: 'error',
        status: 403,
        code:
          account.user.status === 'PENDING'
            ? 'ACCOUNT_PENDING'
            : 'ACCOUNT_SUSPENDED',
      };
    }
    let result:
      | ApiResult<never>
      | { kind: 'ok'; data: ReturnType<FakeApi['issue']> & { user: SafeUser } };
    if (out) result = out;
    else {
      const session: ServerSession = {
        user: account!.user,
        revoked: false,
        refreshToken: this.token('rt'),
        usedRefreshTokens: new Set(),
        accessTokens: new Set(),
        expiresAt: this.clock.now() + SESSION_TTL_MS,
      };
      this.sessions.push(session);
      result = {
        kind: 'ok',
        data: { ...this.issue(session), user: session.user },
      };
    }
    await this.gates.login.wait();
    return result as ApiResult<never>;
  }

  async me(accessToken: string) {
    this.calls.me++;
    const forced = this.forced.me;
    if (forced) return forced;
    const session = this.byAccess(accessToken);
    await this.gates.me.wait();
    if (!session || session.revoked)
      return { kind: 'error', status: 401 } as ApiResult<never>;
    return { kind: 'ok', data: session.user } as ApiResult<never>;
  }

  async refresh(refreshToken: string) {
    this.calls.refresh++;
    const forced = this.forced.refresh;
    if (forced) return forced;
    const session = this.sessions.find(
      (s) =>
        s.refreshToken === refreshToken ||
        s.usedRefreshTokens.has(refreshToken),
    );
    let result: ApiResult<never>;
    if (!session || session.revoked || session.expiresAt <= this.clock.now()) {
      result = { kind: 'error', status: 401 };
    } else if (session.usedRefreshTokens.has(refreshToken)) {
      session.revoked = true; // replay of a used token
      result = { kind: 'error', status: 401 };
    } else if (session.user.status !== 'ACTIVE') {
      session.revoked = true;
      result = { kind: 'error', status: 403, code: 'ACCOUNT_SUSPENDED' };
    } else {
      session.usedRefreshTokens.add(refreshToken);
      session.refreshToken = this.token('rt');
      result = {
        kind: 'ok',
        data: { ...this.issue(session), user: session.user },
      } as never;
    }
    await this.gates.refresh.wait(); // the API already handled it; only the answer is held back
    return result;
  }

  async logout(accessToken: string) {
    this.calls.logout++;
    const forced = this.forced.logout;
    if (forced) return forced as ApiResult<void>;
    const session = this.byAccess(accessToken);
    await this.gates.logout.wait();
    if (!session || session.revoked)
      return { kind: 'error', status: 401 } as ApiResult<void>;
    session.revoked = true;
    return { kind: 'ok', data: undefined } as ApiResult<void>;
  }
}

/** In-memory TokenStorage that records what was written and can be slowed down or broken. */
export class MemoryStorage implements TokenStorage {
  value: StoredSession | null = null;
  log: ('save' | 'clear')[] = [];
  saveDelayMs = 0;
  failSaves = false;

  constructor(initial: StoredSession | null = null) {
    this.value = initial;
  }

  async load() {
    return this.value ? { ...this.value } : null;
  }
  async save(session: StoredSession) {
    if (this.saveDelayMs)
      await new Promise((r) => setTimeout(r, this.saveDelayMs));
    if (this.failSaves) throw new Error('keychain locked');
    this.log.push('save');
    this.value = { ...session };
  }
  async clear() {
    this.log.push('clear');
    this.value = null;
  }
}
