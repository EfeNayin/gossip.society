import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import {
  loginResponseSchema,
  refreshResponseSchema,
  type LoginResponse,
} from '@gossip/shared';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.js';

// Runs against the real database. Every row it creates belongs to users whose
// e-mail starts with `itest-`, and only those users are deleted afterwards.
// Existing seed accounts are never read or changed.
const PASSWORD = 'integration-test-password';
const RUN = randomUUID().slice(0, 8);

describe('auth sessions against PostgreSQL', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let jwt: JwtService;
  const createdUserIds: string[] = [];
  let passwordHash: string;

  const post = (path: string, body?: unknown, token?: string) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const me = (token: string) =>
    fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
  const refresh = (refreshToken: string) =>
    post('/auth/refresh', { refreshToken });
  const logout = (token: string) => post('/auth/logout', undefined, token);

  async function createUser(
    overrides: {
      status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
      role?: 'INFLUENCER' | 'ADMIN';
    } = {},
  ) {
    const user = await prisma.user.create({
      data: {
        email: `itest-${RUN}-${randomUUID()}@gossip-society.example`,
        name: 'Integration Test',
        role: overrides.role ?? 'INFLUENCER',
        status: overrides.status ?? 'ACTIVE',
        passwordHash,
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  async function login(email: string): Promise<LoginResponse> {
    const res = await post('/auth/login', { email, password: PASSWORD });
    expect(res.status).toBe(200);
    return loginResponseSchema.parse(await res.json());
  }
  const sidOf = (accessToken: string) =>
    jwt.decode<{ sid: string }>(accessToken).sid;

  beforeAll(async () => {
    passwordHash = await hash(PASSWORD);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = moduleRef.get(PrismaService);
    jwt = moduleRef.get(JwtService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    // Sessions and refresh tokens go with their users (ON DELETE CASCADE).
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  it('runs login -> me -> refresh -> me -> logout and stores only token hashes', async () => {
    const user = await createUser();
    const first = await login(user.email);
    expect((await me(first.accessToken)).status).toBe(200);

    const sessionBefore = await prisma.authSession.findUniqueOrThrow({
      where: { id: sidOf(first.accessToken) },
    });
    expect(sessionBefore.revokedAt).toBeNull();
    const rows = await prisma.refreshToken.findMany({
      where: { sessionId: sessionBefore.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashRefreshToken(first.refreshToken));
    expect(JSON.stringify(rows)).not.toContain(first.refreshToken);

    const res = await refresh(first.refreshToken);
    expect(res.status).toBe(200);
    const second = refreshResponseSchema.parse(await res.json());
    expect((await me(second.accessToken)).status).toBe(200);

    const sessionAfter = await prisma.authSession.findUniqueOrThrow({
      where: { id: sessionBefore.id },
    });
    expect(sessionAfter.expiresAt.getTime()).toBe(
      sessionBefore.expiresAt.getTime(),
    );
    expect(sessionAfter.lastRefreshedAt).not.toBeNull();
    const all = await prisma.refreshToken.findMany({
      where: { sessionId: sessionBefore.id },
    });
    expect(all).toHaveLength(2);
    expect(all.filter((t) => t.usedAt === null)).toHaveLength(1);

    expect((await logout(second.accessToken)).status).toBe(204);
    expect((await me(second.accessToken)).status).toBe(401);
    expect((await refresh(second.refreshToken)).status).toBe(401);
    const revoked = await prisma.authSession.findUniqueOrThrow({
      where: { id: sessionBefore.id },
    });
    expect(revoked.revokedAt).not.toBeNull();
  });

  it('commits the revocation when a used token is replayed, despite the 401', async () => {
    const user = await createUser();
    const first = await login(user.email);
    const second = refreshResponseSchema.parse(
      await (await refresh(first.refreshToken)).json(),
    );

    expect((await refresh(first.refreshToken)).status).toBe(401);

    const session = await prisma.authSession.findUniqueOrThrow({
      where: { id: sidOf(first.accessToken) },
    });
    expect(session.revokedAt).not.toBeNull();
    expect((await refresh(second.refreshToken)).status).toBe(401);
    expect((await me(second.accessToken)).status).toBe(401);
  });

  it('never lets two concurrent refreshes with the same token both succeed', async () => {
    const user = await createUser();
    for (let round = 0; round < 10; round++) {
      const start = await login(user.email);
      const responses = await Promise.all(
        Array.from({ length: 6 }, () => refresh(start.refreshToken)),
      );
      const statuses = responses.map((r) => r.status);
      const winners = responses.filter((r) => r.status === 200);
      expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(1);
      expect(statuses.every((s) => s === 200 || s === 401)).toBe(true);

      const sessionId = sidOf(start.accessToken);
      const session = await prisma.authSession.findUniqueOrThrow({
        where: { id: sessionId },
      });
      // Replay detection fired, so the session (and any winner's tokens) is dead.
      expect(session.revokedAt).not.toBeNull();
      const unused = await prisma.refreshToken.count({
        where: { sessionId, usedAt: null },
      });
      expect(unused).toBeLessThanOrEqual(1);
      for (const winner of winners) {
        const issued = refreshResponseSchema.parse(await winner.json());
        expect((await refresh(issued.refreshToken)).status).toBe(401);
        expect((await me(issued.accessToken)).status).toBe(401);
      }
    }
  });

  it('never reactivates a session when refresh and logout race', async () => {
    const user = await createUser();
    for (let round = 0; round < 15; round++) {
      const start = await login(user.email);
      const [refreshRes, logoutRes] = await Promise.all([
        refresh(start.refreshToken),
        logout(start.accessToken),
      ]);
      expect(logoutRes.status).toBe(204);
      expect([200, 401]).toContain(refreshRes.status);

      const session = await prisma.authSession.findUniqueOrThrow({
        where: { id: sidOf(start.accessToken) },
      });
      expect(session.revokedAt).not.toBeNull();

      if (refreshRes.status === 200) {
        const issued = refreshResponseSchema.parse(await refreshRes.json());
        expect((await me(issued.accessToken)).status).toBe(401);
        expect((await refresh(issued.refreshToken)).status).toBe(401);
      }
      expect((await refresh(start.refreshToken)).status).toBe(401);
    }
  });

  it('rolls back the session when token signing fails during login', async () => {
    const user = await createUser();
    vi.spyOn(jwt, 'signAsync').mockRejectedValueOnce(new Error('boom'));
    expect(
      (await post('/auth/login', { email: user.email, password: PASSWORD }))
        .status,
    ).toBe(500);
    expect(await prisma.authSession.count({ where: { userId: user.id } })).toBe(
      0,
    );
  });

  it('rolls back a refresh when signing fails, leaving the old token usable', async () => {
    const user = await createUser();
    const start = await login(user.email);
    vi.spyOn(jwt, 'signAsync').mockRejectedValueOnce(new Error('boom'));

    expect((await refresh(start.refreshToken)).status).toBe(500);

    const tokens = await prisma.refreshToken.findMany({
      where: { sessionId: sidOf(start.accessToken) },
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.usedAt).toBeNull();
    expect((await refresh(start.refreshToken)).status).toBe(200);
  });

  it('keeps one user’s sessions independent', async () => {
    const user = await createUser();
    const a = await login(user.email);
    const b = await login(user.email);
    expect(sidOf(a.accessToken)).not.toBe(sidOf(b.accessToken));

    expect((await logout(a.accessToken)).status).toBe(204);
    expect((await me(b.accessToken)).status).toBe(200);
    expect((await refresh(b.refreshToken)).status).toBe(200);

    // Replay on A (already revoked) must not touch B.
    await refresh(a.refreshToken);
    const bSession = await prisma.authSession.findUniqueOrThrow({
      where: { id: sidOf(b.accessToken) },
    });
    expect(bSession.revokedAt).toBeNull();
  });

  it('cannot revoke another user’s session with an unknown or foreign token', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const aliceLogin = await login(alice.email);
    const bobLogin = await login(bob.email);

    expect((await refresh(generateRefreshToken().token)).status).toBe(401);
    // Alice presenting Bob's *access* token as a refresh token revokes nothing.
    expect((await refresh(bobLogin.accessToken)).status).toBe(401);
    expect((await logout(aliceLogin.accessToken)).status).toBe(204);

    expect((await me(bobLogin.accessToken)).status).toBe(200);
  });

  it('rejects expired sessions', async () => {
    const user = await createUser();
    const body = await login(user.email);
    await prisma.authSession.update({
      where: { id: sidOf(body.accessToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await me(body.accessToken)).status).toBe(401);
    expect((await refresh(body.refreshToken)).status).toBe(401);
  });

  it('caps a refreshed access token at the session expiry', async () => {
    const user = await createUser();
    const body = await login(user.email);
    const expiresAt = new Date(Date.now() + 60_000);
    await prisma.authSession.update({
      where: { id: sidOf(body.accessToken) },
      data: { expiresAt },
    });
    const next = refreshResponseSchema.parse(
      await (await refresh(body.refreshToken)).json(),
    );
    expect(Date.parse(next.accessTokenExpiresAt)).toBeLessThanOrEqual(
      expiresAt.getTime(),
    );
    expect(next.refreshTokenExpiresAt).toBe(expiresAt.toISOString());
  });

  it('refuses refresh for a suspended account and revokes the session', async () => {
    const user = await createUser();
    const body = await login(user.email);
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'SUSPENDED' },
    });

    expect((await me(body.accessToken)).status).toBe(403);
    const res = await refresh(body.refreshToken);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe(
      'ACCOUNT_SUSPENDED',
    );

    const session = await prisma.authSession.findUniqueOrThrow({
      where: { id: sidOf(body.accessToken) },
    });
    expect(session.revokedAt).not.toBeNull();
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE' },
    });
    expect((await refresh(body.refreshToken)).status).toBe(401);
  });

  it('removes sessions and tokens with a deleted user and rejects them', async () => {
    const user = await createUser();
    const body = await login(user.email);
    const sessionId = sidOf(body.accessToken);
    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.authSession.count({ where: { id: sessionId } })).toBe(
      0,
    );
    expect(await prisma.refreshToken.count({ where: { sessionId } })).toBe(0);
    expect((await me(body.accessToken)).status).toBe(401);
    expect((await refresh(body.refreshToken)).status).toBe(401);
  });

  it('applies the current role from the database to a session', async () => {
    const user = await createUser();
    const body = await login(user.email);
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });
    const profile = (await (await me(body.accessToken)).json()) as {
      role: string;
    };
    expect(profile.role).toBe('ADMIN');
    const refreshed = refreshResponseSchema.parse(
      await (await refresh(body.refreshToken)).json(),
    );
    expect(refreshed.user.role).toBe('ADMIN');
  });

  describe('database constraints', () => {
    it('allows only one unused refresh token per session', async () => {
      const user = await createUser();
      const body = await login(user.email);
      const sessionId = sidOf(body.accessToken);
      await expect(
        prisma.refreshToken.create({
          data: { sessionId, tokenHash: generateRefreshToken().hash },
        }),
      ).rejects.toThrow();
      expect(await prisma.refreshToken.count({ where: { sessionId } })).toBe(1);
    });

    it('rejects a duplicate token hash and an orphan session', async () => {
      const user = await createUser();
      const body = await login(user.email);
      const existing = await prisma.refreshToken.findFirstOrThrow({
        where: { sessionId: sidOf(body.accessToken) },
      });
      const other = await prisma.authSession.create({
        data: { userId: user.id, expiresAt: new Date(Date.now() + 60_000) },
      });
      await expect(
        prisma.refreshToken.create({
          data: { sessionId: other.id, tokenHash: existing.tokenHash },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.authSession.create({
          data: {
            userId: randomUUID(),
            expiresAt: new Date(Date.now() + 60_000),
          },
        }),
      ).rejects.toThrow();
    });
  });
});
