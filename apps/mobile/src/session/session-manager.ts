import {
  loginRequestSchema,
  type LoginRequest,
  type SafeUser,
} from '@gossip/shared';
import { accountStatusMessage, messages } from './messages';
import type {
  ApiResult,
  AuthApi,
  LoginResult,
  LogoutResult,
  Notice,
  RequestResult,
  SessionSnapshot,
  StoredSession,
  TokenStorage,
} from './types';

// Renew a little before the real expiry so a token isn't sent as it expires.
const ACCESS_SKEW_MS = 30_000;
// Don't re-check the session on every foreground event.
const REVALIDATE_MIN_INTERVAL_MS = 15_000;

type RefreshResult =
  | { kind: 'ok'; session: StoredSession; user: SafeUser }
  // The API refused the token (unknown, used, expired, revoked, account not
  // ACTIVE). `inactive` is the 403 "account not ACTIVE" case.
  | { kind: 'rejected'; inactive: boolean }
  // Network error, 429 or 5xx: the session may still be fine.
  | { kind: 'unavailable' };

/**
 * The mobile session: sign in, keep the tokens, renew them, validate them, sign
 * out. It knows nothing about React Native; storage and API are injected.
 *
 * Race protection: every sign-in, sign-out and session end increments
 * `generation`. Anything that was started under an older generation (a refresh
 * still on the wire, a login that finished late) is checked against it
 * synchronously right before it would change state or storage, and dropped if
 * the generation moved on. Storage writes go through one queue, in the order
 * they were decided, so a stale write can never land after a newer clear/save.
 *
 * A refresh token is exchanged at most once at a time: concurrent callers share
 * one request (the API revokes a session whose used token is shown again).
 */
export class SessionManager {
  private snapshot: SessionSnapshot = {
    status: 'loading',
    user: null,
    notice: null,
  };
  private tokens: StoredSession | null = null;
  private generation = 0;
  private readonly listeners = new Set<() => void>();
  private storageQueue: Promise<unknown> = Promise.resolve();
  private readonly refreshInFlight = new Map<string, Promise<RefreshResult>>();
  private validating: Promise<void> | null = null;
  private loggingIn: Promise<LoginResult> | null = null;
  private lastValidatedAt = 0;

  constructor(
    private readonly deps: {
      api: AuthApi;
      storage: TokenStorage;
      now?: () => number;
    },
  ) {}

  // --- observable state (for useSyncExternalStore) -------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): SessionSnapshot => this.snapshot;

  private set(next: Partial<SessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) listener();
  }

  dismissNotice() {
    if (this.snapshot.notice) this.set({ notice: null });
  }

  private now() {
    return (this.deps.now ?? Date.now)();
  }

  // --- storage (single ordered queue) --------------------------------------

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const run = this.storageQueue.then(operation).catch(() => {
      // A failed write must not break the app: the session stays in memory.
      // (If a rotated refresh token couldn't be saved, the stored one is
      // stale and the next launch will need a new sign-in.)
    });
    this.storageQueue = run;
    return run;
  }

  private persist(session: StoredSession) {
    return this.enqueue(() => this.deps.storage.save(session));
  }

  private wipeStorage() {
    return this.enqueue(() => this.deps.storage.clear());
  }

  // --- start-up and validation ---------------------------------------------

  /** Loads a stored session (if any) and checks it with the API. */
  async start(): Promise<void> {
    const gen = this.generation;
    const stored = await this.deps.storage.load().catch(() => null);
    if (gen !== this.generation) return; // a login happened while loading
    if (!stored || stored.refreshExpiresAt <= this.now()) {
      if (stored) void this.wipeStorage();
      this.set({ status: 'signedOut', user: null });
      return;
    }
    this.tokens = stored;
    await this.validate({ force: true });
  }

  /**
   * Asks the API who the stored tokens belong to (renewing them if needed).
   * Called on start and when the app returns to the foreground.
   */
  validate(options: { force?: boolean } = {}): Promise<void> {
    if (!this.tokens) return Promise.resolve();
    if (this.validating) return this.validating;
    if (
      !options.force &&
      this.snapshot.status === 'signedIn' &&
      this.now() - this.lastValidatedAt < REVALIDATE_MIN_INTERVAL_MS
    ) {
      return Promise.resolve();
    }

    const gen = this.generation;
    const run = (async () => {
      const result = await this.request((token) => this.deps.api.me(token));
      if (gen !== this.generation) return; // the session changed meanwhile
      this.lastValidatedAt = this.now();

      if (result.kind === 'ok') {
        if (result.data.role === 'ADMIN') {
          await this.rejectAdmin();
        } else {
          this.set({ status: 'signedIn', user: result.data });
        }
      } else if (
        result.kind === 'error' &&
        result.status === 403 &&
        result.code
      ) {
        this.endSession(gen, 'inactive');
      } else if (result.kind === 'unauthorized') {
        // request() already ended the session.
      } else if (result.kind !== 'cancelled') {
        // Offline, 5xx, 429...: keep the session and let the user retry.
        this.set({ status: 'unavailable' });
      }
    })().finally(() => {
      this.validating = null;
    });
    this.validating = run;
    return run;
  }

  // --- authorized requests with exactly one renewal attempt ----------------

  /**
   * Runs an API call with a valid access token. If the token is expired it is
   * renewed first; if the API still answers 401 the token is renewed once more
   * and the call is retried ONCE. A second 401 means the session is over.
   */
  async request<T>(
    call: (accessToken: string) => Promise<ApiResult<T>>,
  ): Promise<RequestResult<T>> {
    const gen = this.generation;

    const ready = await this.ensureFresh(gen);
    if (ready === 'stale') return { kind: 'cancelled' };
    if (ready === 'rejected') return { kind: 'unauthorized' };
    if (ready === 'unavailable') return { kind: 'unreachable' };

    const used = this.tokens?.accessToken;
    if (!used) return { kind: 'cancelled' };
    const first = await call(used);
    if (!(first.kind === 'error' && first.status === 401)) return first;

    // The API doesn't accept the token although our clock says it is valid.
    const renewed = await this.renewAfterRejection(gen, used);
    if (renewed === 'stale') return { kind: 'cancelled' };
    if (renewed === 'rejected') return { kind: 'unauthorized' };
    if (renewed === 'unavailable') return { kind: 'unreachable' };

    const retryToken = this.tokens?.accessToken;
    if (!retryToken || gen !== this.generation) return { kind: 'cancelled' };
    const second = await call(retryToken);
    if (second.kind === 'error' && second.status === 401) {
      // A fresh token was refused too: no retry loop, the session is over.
      this.endSession(gen, 'expired');
      return { kind: 'unauthorized' };
    }
    return second;
  }

  private accessUsable(session: StoredSession) {
    return session.accessExpiresAt - this.now() > ACCESS_SKEW_MS;
  }

  private async ensureFresh(
    gen: number,
  ): Promise<'ok' | 'rejected' | 'unavailable' | 'stale'> {
    const tokens = this.tokens;
    if (!tokens || gen !== this.generation) return 'stale';
    if (this.accessUsable(tokens)) return 'ok';
    return this.refresh(gen, tokens.refreshToken);
  }

  private async renewAfterRejection(gen: number, rejectedAccessToken: string) {
    const tokens = this.tokens;
    if (!tokens || gen !== this.generation) return 'stale' as const;
    // Someone already renewed since this call started: just retry with that.
    if (tokens.accessToken !== rejectedAccessToken) return 'ok' as const;
    return this.refresh(gen, tokens.refreshToken);
  }

  /** Exchanges `refreshToken` (shared by concurrent callers) and applies the result. */
  private async refresh(
    gen: number,
    refreshToken: string,
  ): Promise<'ok' | 'rejected' | 'unavailable' | 'stale'> {
    const result = await this.exchange(refreshToken);

    // From here to the state/storage change everything is synchronous.
    if (gen !== this.generation) return 'stale';

    if (result.kind === 'ok') {
      // Several callers joined the same exchange; apply it once.
      if (this.tokens?.refreshToken === refreshToken) {
        this.tokens = result.session;
        void this.persist(result.session);
        if (result.user.role !== 'ADMIN') this.set({ user: result.user });
      }
      return 'ok';
    }
    if (result.kind === 'rejected') {
      this.endSession(gen, result.inactive ? 'inactive' : 'expired');
      return 'rejected';
    }
    return 'unavailable';
  }

  /** One API refresh call per refresh token at a time. */
  private exchange(refreshToken: string): Promise<RefreshResult> {
    const existing = this.refreshInFlight.get(refreshToken);
    if (existing) return existing;

    const promise = this.deps.api
      .refresh(refreshToken)
      .then<RefreshResult>((response) => {
        if (response.kind === 'ok') {
          const d = response.data;
          return {
            kind: 'ok',
            user: d.user,
            session: {
              accessToken: d.accessToken,
              accessExpiresAt: Date.parse(d.accessTokenExpiresAt),
              refreshToken: d.refreshToken,
              refreshExpiresAt: Date.parse(d.refreshTokenExpiresAt),
            },
          };
        }
        if (
          response.kind === 'error' &&
          (response.status === 401 || response.status === 403)
        ) {
          return { kind: 'rejected', inactive: response.status === 403 };
        }
        return { kind: 'unavailable' };
      });
    this.refreshInFlight.set(refreshToken, promise);
    const forget = () => {
      if (this.refreshInFlight.get(refreshToken) === promise) {
        this.refreshInFlight.delete(refreshToken);
      }
    };
    promise.then(forget, forget);
    return promise;
  }

  // --- ending a session locally --------------------------------------------

  /** The session is unusable: forget it here. Ignored if a newer session started. */
  private endSession(gen: number, notice: Notice) {
    if (gen !== this.generation) return;
    this.generation++;
    this.tokens = null;
    this.set({ status: 'signedOut', user: null, notice });
    void this.wipeStorage();
  }

  // --- sign in --------------------------------------------------------------

  login(credentials: LoginRequest): Promise<LoginResult> {
    // A second tap while a sign-in is running joins it instead of starting another.
    if (this.loggingIn) return this.loggingIn;
    const run = this.doLogin(credentials).finally(() => {
      this.loggingIn = null;
    });
    this.loggingIn = run;
    return run;
  }

  private async doLogin(credentials: LoginRequest): Promise<LoginResult> {
    const parsed = loginRequestSchema.safeParse(credentials);
    if (!parsed.success)
      return { kind: 'error', message: messages.invalidForm };

    // Anything still running for an earlier session must not touch this one.
    const gen = ++this.generation;
    const result = await this.deps.api.login(parsed.data);

    if (result.kind === 'unreachable')
      return { kind: 'error', message: messages.unreachable };
    if (result.kind === 'error') {
      if (result.status === 401)
        return { kind: 'error', message: messages.invalidCredentials };
      if (result.status === 403 && result.code) {
        return { kind: 'error', message: accountStatusMessage(result.code) };
      }
      if (result.status === 429)
        return { kind: 'error', message: messages.rateLimited };
      if (result.status === 400)
        return { kind: 'error', message: messages.invalidForm };
      return { kind: 'error', message: messages.unexpected };
    }

    const { data } = result;
    const session: StoredSession = {
      accessToken: data.accessToken,
      accessExpiresAt: Date.parse(data.accessTokenExpiresAt),
      refreshToken: data.refreshToken,
      refreshExpiresAt: Date.parse(data.refreshTokenExpiresAt),
    };

    // A logout (or another login) happened while we waited: apply nothing and
    // revoke the session this login just created.
    if (gen !== this.generation) {
      void this.deps.api.logout(session.accessToken);
      return { kind: 'cancelled' };
    }

    if (data.user.role === 'ADMIN') {
      // The admin panel is a web app. Don't keep this session: revoke it.
      await this.deps.api.logout(session.accessToken);
      this.set({ status: 'signedOut', user: null, notice: 'admin-web' });
      return { kind: 'admin-web' };
    }

    this.tokens = session;
    this.lastValidatedAt = this.now();
    this.set({ status: 'signedIn', user: data.user, notice: null });
    await this.persist(session);
    return { kind: 'ok' };
  }

  /** A stored session turned out to belong to an ADMIN: revoke it and sign out. */
  private async rejectAdmin() {
    const tokens = this.tokens;
    this.generation++;
    this.tokens = null;
    this.set({ status: 'signedOut', user: null, notice: 'admin-web' });
    void this.wipeStorage();
    if (tokens) await this.revokeOnServer(tokens);
  }

  // --- sign out -------------------------------------------------------------

  /**
   * Signs out on this device immediately, then revokes the session on the
   * server with the tokens it had. If the access token has expired it is
   * renewed first (the logout endpoint needs one). If the server can't be
   * reached the local sign-out still stands, and the result says so.
   */
  async logout(): Promise<LogoutResult> {
    const tokens = this.tokens;
    this.generation++;
    this.tokens = null;
    this.set({ status: 'signedOut', user: null, notice: 'logout' });
    void this.wipeStorage();
    if (!tokens) return 'none';

    const outcome = await this.revokeOnServer(tokens);
    if (
      outcome === 'failed' &&
      this.snapshot.status === 'signedOut' &&
      this.snapshot.notice === 'logout'
    ) {
      this.set({ notice: 'logout-local' });
    }
    return outcome;
  }

  private async revokeOnServer(
    tokens: StoredSession,
  ): Promise<Exclude<LogoutResult, 'none'>> {
    let accessToken = tokens.accessToken;
    if (!this.accessUsable(tokens)) {
      // Join an exchange that may already be running for these tokens (a
      // refresh token must be used once); its result is used only to log out.
      const renewed = await this.exchange(tokens.refreshToken);
      if (renewed.kind === 'rejected') return 'already-invalid';
      if (renewed.kind === 'unavailable') return 'failed';
      accessToken = renewed.session.accessToken;
    }
    const result = await this.deps.api.logout(accessToken);
    if (result.kind === 'ok') return 'revoked';
    if (result.kind === 'error' && result.status === 401)
      return 'already-invalid';
    return 'failed';
  }
}
