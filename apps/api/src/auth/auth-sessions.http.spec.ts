import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash } from '@node-rs/argon2';
import {
  accountStatusErrorSchema,
  loginResponseSchema,
  refreshResponseSchema,
  type LoginResponse,
} from '@gossip/shared';
import {
  createFakePrisma,
  createSessionWithToken,
  createTestApp,
  makeUser,
} from './auth-test-utils.js';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.js';

const PASSWORD = 'correct horse battery staple';
const ids = {
  alice: '00000000-0000-4000-8000-0000000000c1',
  bob: '00000000-0000-4000-8000-0000000000c2',
};
const emailOf = (id: string) => `${id}@gossip-society.example`;

describe('auth sessions over HTTP', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtService;
  let fake: ReturnType<typeof createFakePrisma>;

  const post = (path: string, body?: unknown, token?: string) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const get = (path: string, token?: string) =>
    fetch(`${baseUrl}${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  async function login(id = ids.alice): Promise<LoginResponse> {
    const res = await post('/auth/login', {
      email: emailOf(id),
      password: PASSWORD,
    });
    expect(res.status).toBe(200);
    return loginResponseSchema.parse(await res.json());
  }
  const refresh = (refreshToken: string) =>
    post('/auth/refresh', { refreshToken });
  const me = (accessToken: string) => get('/auth/me', accessToken);

  beforeEach(async () => {
    fake = createFakePrisma();
    const passwordHash = await hash(PASSWORD);
    for (const id of Object.values(ids)) {
      fake.users.set(id, makeUser({ id, passwordHash }));
    }
    const created = await createTestApp(fake.prisma);
    app = created.app;
    baseUrl = created.baseUrl;
    jwt = created.moduleRef.get(JwtService);
  });

  afterEach(() => app.close());

  describe('login', () => {
    it('creates a session and returns an opaque refresh token', async () => {
      const body = await login();
      expect(fake.sessions.size).toBe(1);
      const session = [...fake.sessions.values()][0]!;
      expect(session.userId).toBe(ids.alice);
      expect(body.refreshTokenExpiresAt).toBe(session.expiresAt.toISOString());
      // 32 random bytes, base64url: not a JWT.
      expect(body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(body.refreshToken.split('.')).toHaveLength(1);
      expect(jwt.decode<{ sid: string }>(body.accessToken).sid).toBe(
        session.id,
      );
    });

    it('stores only the SHA-256 hash of the refresh token', async () => {
      const body = await login();
      const [row] = [...fake.refreshTokens.values()];
      expect(row!.tokenHash).toBe(hashRefreshToken(body.refreshToken));
      expect(row!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(
        JSON.stringify([
          ...fake.sessions.values(),
          ...fake.refreshTokens.values(),
        ]),
      ).not.toContain(body.refreshToken);
    });

    it('creates a separate session for every login', async () => {
      const first = await login();
      const second = await login();
      expect(fake.sessions.size).toBe(2);
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect((await me(first.accessToken)).status).toBe(200);
      expect((await me(second.accessToken)).status).toBe(200);
    });

    it('caps the access token at the session expiry', async () => {
      const body = await login();
      expect(Date.parse(body.accessTokenExpiresAt)).toBeLessThanOrEqual(
        Date.parse(body.refreshTokenExpiresAt),
      );
    });

    it('leaves nothing behind when token signing fails', async () => {
      vi.spyOn(jwt, 'signAsync').mockRejectedValueOnce(new Error('boom'));
      const res = await post('/auth/login', {
        email: emailOf(ids.alice),
        password: PASSWORD,
      });
      expect(res.status).toBe(500);
      expect(fake.sessions.size).toBe(0);
      expect(fake.refreshTokens.size).toBe(0);
    });
  });

  describe('full flow', () => {
    it('login -> me -> refresh -> me -> logout -> rejected', async () => {
      const first = await login();
      expect((await me(first.accessToken)).status).toBe(200);

      const res = await refresh(first.refreshToken);
      expect(res.status).toBe(200);
      const second = refreshResponseSchema.parse(await res.json());
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(second.user.id).toBe(ids.alice);
      expect(fake.sessions.size).toBe(1);
      expect((await me(second.accessToken)).status).toBe(200);

      const out = await post('/auth/logout', undefined, second.accessToken);
      expect(out.status).toBe(204);
      expect(await out.text()).toBe('');

      expect((await me(second.accessToken)).status).toBe(401);
      expect((await refresh(second.refreshToken)).status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('needs no access token and validates the body', async () => {
      expect((await post('/auth/refresh', {})).status).toBe(400);
      expect((await post('/auth/refresh', { refreshToken: '' })).status).toBe(
        400,
      );
      const { refreshToken } = await login();
      expect((await post('/auth/refresh', { refreshToken })).status).toBe(200);
    });

    it('does not extend the absolute session lifetime', async () => {
      const first = await login();
      const second = refreshResponseSchema.parse(
        await (await refresh(first.refreshToken)).json(),
      );
      const third = refreshResponseSchema.parse(
        await (await refresh(second.refreshToken)).json(),
      );
      expect(second.refreshTokenExpiresAt).toBe(first.refreshTokenExpiresAt);
      expect(third.refreshTokenExpiresAt).toBe(first.refreshTokenExpiresAt);
      expect([...fake.sessions.values()][0]!.expiresAt.toISOString()).toBe(
        first.refreshTokenExpiresAt,
      );
    });

    it('never issues an access token that outlives the session', async () => {
      const session = await fake.prisma.authSession.create({
        data: { userId: ids.alice, expiresAt: new Date(Date.now() + 60_000) },
      });
      const { token, hash: tokenHash } = generateRefreshToken();
      await fake.prisma.refreshToken.create({
        data: { sessionId: session.id, tokenHash },
      });

      const body = refreshResponseSchema.parse(
        await (await refresh(token)).json(),
      );
      expect(Date.parse(body.accessTokenExpiresAt)).toBeLessThanOrEqual(
        session.expiresAt.getTime(),
      );
      // Capped to the ~60 s the session has left, not the 900 s access TTL.
      expect(Date.parse(body.accessTokenExpiresAt) - Date.now()).toBeLessThan(
        61_000,
      );
    });

    it('rejects an unknown token with the generic 401 and revokes nothing', async () => {
      const alice = await login();
      const res = await refresh(generateRefreshToken().token);
      expect(res.status).toBe(401);
      expect((await me(alice.accessToken)).status).toBe(200);
      expect(
        [...fake.sessions.values()].every((s) => s.revokedAt === null),
      ).toBe(true);
    });

    it('rejects a used token and revokes the whole session, new tokens included', async () => {
      const first = await login();
      const second = refreshResponseSchema.parse(
        await (await refresh(first.refreshToken)).json(),
      );

      const reuse = await refresh(first.refreshToken);
      expect(reuse.status).toBe(401);

      expect([...fake.sessions.values()][0]!.revokedAt).not.toBeNull();
      expect((await refresh(second.refreshToken)).status).toBe(401);
      expect((await me(second.accessToken)).status).toBe(401);
      expect((await me(first.accessToken)).status).toBe(401);
    });

    it('answers a reused token exactly like an unknown one', async () => {
      const first = await login();
      await refresh(first.refreshToken);
      const reused = await refresh(first.refreshToken);
      const unknown = await refresh(generateRefreshToken().token);
      expect(await reused.json()).toEqual(await unknown.json());
    });

    it('reuse in one session leaves the same user’s other session alone', async () => {
      const a = await login();
      const b = await login();
      await refresh(a.refreshToken);
      await refresh(a.refreshToken); // reuse: revokes session A only

      expect((await me(b.accessToken)).status).toBe(200);
      expect((await refresh(b.refreshToken)).status).toBe(200);
    });

    it('rejects expired and revoked sessions', async () => {
      const expired = await login();
      [...fake.sessions.values()][0]!.expiresAt = new Date(Date.now() - 1000);
      expect((await refresh(expired.refreshToken)).status).toBe(401);

      const revoked = await login(ids.bob);
      const bobSession = [...fake.sessions.values()].find(
        (s) => s.userId === ids.bob,
      )!;
      bobSession.revokedAt = new Date();
      expect((await refresh(revoked.refreshToken)).status).toBe(401);
    });

    it.each([
      ['SUSPENDED', 'ACCOUNT_SUSPENDED'],
      ['PENDING', 'ACCOUNT_PENDING'],
    ] as const)(
      'refuses a %s account with %s and revokes the session',
      async (status, code) => {
        const body = await login();
        fake.users.set(ids.alice, { ...fake.users.get(ids.alice)!, status });

        const res = await refresh(body.refreshToken);
        expect(res.status).toBe(403);
        expect(accountStatusErrorSchema.parse(await res.json()).code).toBe(
          code,
        );
        expect([...fake.sessions.values()][0]!.revokedAt).not.toBeNull();

        // Even after reactivation the old session stays dead.
        fake.users.set(ids.alice, {
          ...fake.users.get(ids.alice)!,
          status: 'ACTIVE',
        });
        expect((await refresh(body.refreshToken)).status).toBe(401);
        expect((await me(body.accessToken)).status).toBe(401);
      },
    );

    it('keeps the old token usable when signing fails, so the client can retry', async () => {
      const body = await login();
      vi.spyOn(jwt, 'signAsync').mockRejectedValueOnce(new Error('boom'));
      expect((await refresh(body.refreshToken)).status).toBe(500);
      expect(fake.refreshTokens.size).toBe(1);
      expect([...fake.refreshTokens.values()][0]!.usedAt).toBeNull();
      expect((await refresh(body.refreshToken)).status).toBe(200);
    });

    it('ignores client-sent session, user and role fields', async () => {
      const alice = await login(ids.alice);
      const bob = await login(ids.bob);
      const res = await post('/auth/refresh', {
        refreshToken: alice.refreshToken,
        sessionId: [...fake.sessions.keys()][1],
        userId: ids.bob,
        role: 'ADMIN',
      });
      const body = refreshResponseSchema.parse(await res.json());
      expect(body.user.id).toBe(ids.alice);
      expect(body.user.role).toBe('INFLUENCER');
      expect((await me(bob.accessToken)).status).toBe(200);
    });
  });

  describe('access guard with sessions', () => {
    it('rejects a refresh token used as a Bearer token', async () => {
      const { refreshToken } = await login();
      expect((await me(refreshToken)).status).toBe(401);
    });

    it('rejects an access token used as a refresh token', async () => {
      const { accessToken } = await login();
      expect((await refresh(accessToken)).status).toBe(401);
    });

    it('rejects a validly signed token without sid (issued before sessions)', async () => {
      const legacy = await jwt.signAsync(
        { exp: Math.floor(Date.now() / 1000) + 900 },
        { subject: ids.alice },
      );
      expect((await me(legacy)).status).toBe(401);
    });

    it('rejects a token whose session does not exist', async () => {
      const token = await jwt.signAsync(
        {
          sid: '00000000-0000-4000-8000-0000000000ee',
          exp: Math.floor(Date.now() / 1000) + 900,
        },
        { subject: ids.alice },
      );
      expect((await me(token)).status).toBe(401);
    });

    it('rejects a token for a session that belongs to another user', async () => {
      const { session } = await createSessionWithToken(fake, jwt, ids.bob);
      const mixed = await jwt.signAsync(
        { sid: session.id, exp: Math.floor(Date.now() / 1000) + 900 },
        { subject: ids.alice },
      );
      expect((await me(mixed)).status).toBe(401);
    });

    it('rejects a token whose session expired or was revoked', async () => {
      const a = await createSessionWithToken(fake, jwt, ids.alice);
      a.session.expiresAt = new Date(Date.now() - 1000);
      expect((await me(a.accessToken)).status).toBe(401);

      const b = await createSessionWithToken(fake, jwt, ids.alice);
      b.session.revokedAt = new Date();
      expect((await me(b.accessToken)).status).toBe(401);
    });

    it('rejects a valid session once the user is suspended or deleted', async () => {
      const a = await login(ids.alice);
      fake.users.set(ids.alice, {
        ...fake.users.get(ids.alice)!,
        status: 'SUSPENDED',
      });
      expect((await me(a.accessToken)).status).toBe(403);

      const b = await login(ids.bob);
      fake.users.delete(ids.bob);
      expect((await me(b.accessToken)).status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('requires a valid access token', async () => {
      expect((await post('/auth/logout')).status).toBe(401);
      const { refreshToken } = await login();
      expect((await post('/auth/logout', undefined, refreshToken)).status).toBe(
        401,
      );
      expect([...fake.sessions.values()][0]!.revokedAt).toBeNull();
    });

    it('revokes only the current session', async () => {
      const a = await login();
      const b = await login();

      expect(
        (await post('/auth/logout', undefined, a.accessToken)).status,
      ).toBe(204);

      expect((await me(a.accessToken)).status).toBe(401);
      expect((await refresh(a.refreshToken)).status).toBe(401);
      expect((await me(b.accessToken)).status).toBe(200);
      expect((await refresh(b.refreshToken)).status).toBe(200);
    });

    it('does not let a client name another session to revoke', async () => {
      const alice = await login(ids.alice);
      const bob = await login(ids.bob);
      const bobSessionId = jwt.decode<{ sid: string }>(bob.accessToken).sid;

      await fetch(`${baseUrl}/auth/logout?sessionId=${bobSessionId}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${alice.accessToken}`,
        },
        body: JSON.stringify({ sessionId: bobSessionId, userId: ids.bob }),
      });

      expect((await me(bob.accessToken)).status).toBe(200);
      expect((await me(alice.accessToken)).status).toBe(401);
    });

    it('answers 401 when the session is already logged out', async () => {
      const { accessToken } = await login();
      expect((await post('/auth/logout', undefined, accessToken)).status).toBe(
        204,
      );
      expect((await post('/auth/logout', undefined, accessToken)).status).toBe(
        401,
      );
    });
  });
});
