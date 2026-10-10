import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash } from '@node-rs/argon2';
import {
  accountStatusErrorSchema,
  loginResponseSchema,
  safeUserSchema,
} from '@gossip/shared';
import {
  createFakePrisma,
  createSessionWithToken,
  createTestApp,
  makeUser,
  type FakeUser,
} from './auth-test-utils.js';

const PASSWORD = 'correct horse battery staple';
const ids = {
  admin: '00000000-0000-4000-8000-0000000000a1',
  owner: '00000000-0000-4000-8000-0000000000a2',
  influencer: '00000000-0000-4000-8000-0000000000a3',
  pending: '00000000-0000-4000-8000-0000000000a4',
  suspended: '00000000-0000-4000-8000-0000000000a5',
  noHash: '00000000-0000-4000-8000-0000000000a6',
};

describe('auth over HTTP', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtService;
  let fake: ReturnType<typeof createFakePrisma>;
  let users: Map<string, FakeUser>;
  let passwordHash: string;

  async function login(body: unknown) {
    return fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function get(
    path: string,
    token?: string,
    headers: Record<string, string> = {},
  ) {
    return fetch(`${baseUrl}${path}`, {
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  }

  // A live session in the fake database plus a matching signed access token.
  const tokenFor = async (id: string) =>
    (await createSessionWithToken(fake, jwt, id)).accessToken;

  const inFifteenMinutes = () => Math.floor(Date.now() / 1000) + 900;

  beforeAll(async () => {
    passwordHash = await hash(PASSWORD);
  });

  beforeEach(async () => {
    fake = createFakePrisma();
    users = fake.users;
    for (const user of [
      makeUser({ id: ids.admin, role: 'ADMIN', passwordHash }),
      makeUser({ id: ids.owner, role: 'VENUE_OWNER', passwordHash }),
      makeUser({ id: ids.influencer, role: 'INFLUENCER', passwordHash }),
      makeUser({ id: ids.pending, status: 'PENDING', passwordHash }),
      makeUser({ id: ids.suspended, status: 'SUSPENDED', passwordHash }),
      makeUser({ id: ids.noHash, passwordHash: null }),
    ]) {
      users.set(user.id, user);
    }
    const created = await createTestApp(fake.prisma);
    app = created.app;
    baseUrl = created.baseUrl;
    jwt = created.moduleRef.get(JwtService);
  });

  afterEach(() => app.close());

  describe('POST /auth/login', () => {
    it('logs an ACTIVE user in and returns only safe fields', async () => {
      const res = await login({
        email: `${ids.influencer}@gossip-society.example`,
        password: PASSWORD,
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).not.toContain('passwordHash');
      expect(text).not.toContain('argon2');
      const body = loginResponseSchema.parse(JSON.parse(text));
      expect(body.user).toMatchObject({
        id: ids.influencer,
        role: 'INFLUENCER',
        status: 'ACTIVE',
      });
      expect(body.accessToken.split('.')).toHaveLength(3);
    });

    it('trims and lowercases the email', async () => {
      const res = await login({
        email: `  ${ids.influencer.toUpperCase()}@Gossip-Society.EXAMPLE `,
        password: PASSWORD,
      });
      expect(res.status).toBe(200);
    });

    it('issues a short-lived token that expires per configuration', async () => {
      const res = await login({
        email: `${ids.admin}@gossip-society.example`,
        password: PASSWORD,
      });
      const { accessToken } = loginResponseSchema.parse(await res.json());
      const claims = jwt.decode<{
        sub: string;
        sid: string;
        exp: number;
        iat: number;
        role?: string;
      }>(accessToken);
      expect(claims.sub).toBe(ids.admin);
      expect([...fake.sessions.keys()]).toEqual([claims.sid]);
      expect(claims.exp - claims.iat).toBeGreaterThanOrEqual(899);
      expect(claims.exp - claims.iat).toBeLessThanOrEqual(900);
      // The role is looked up in the database, never carried in the token.
      expect(claims.role).toBeUndefined();
    });

    it('returns the same generic 401 for wrong password, unknown email and null hash', async () => {
      const wrongPassword = await login({
        email: `${ids.admin}@gossip-society.example`,
        password: 'wrong',
      });
      const unknownEmail = await login({
        email: 'nobody@gossip-society.example',
        password: PASSWORD,
      });
      const nullHash = await login({
        email: `${ids.noHash}@gossip-society.example`,
        password: PASSWORD,
      });
      const bodies = await Promise.all(
        [wrongPassword, unknownEmail, nullHash].map(async (res) => {
          expect(res.status).toBe(401);
          return res.json();
        }),
      );
      expect(bodies[1]).toEqual(bodies[0]);
      expect(bodies[2]).toEqual(bodies[0]);
    });

    it.each([
      ['pending', 'ACCOUNT_PENDING'],
      ['suspended', 'ACCOUNT_SUSPENDED'],
    ] as const)(
      'refuses a %s account with a distinguishable 403 and no token',
      async (key, code) => {
        const res = await login({
          email: `${ids[key]}@gossip-society.example`,
          password: PASSWORD,
        });
        expect(res.status).toBe(403);
        const text = await res.text();
        expect(text).not.toContain('accessToken');
        expect(accountStatusErrorSchema.parse(JSON.parse(text)).code).toBe(
          code,
        );
      },
    );

    it('does not reveal the account status when the password is wrong', async () => {
      const res = await login({
        email: `${ids.suspended}@gossip-society.example`,
        password: 'wrong',
      });
      expect(res.status).toBe(401);
    });

    it.each([
      {},
      { email: 'not-an-email', password: 'x' },
      { email: 'a@b.example' },
    ])('rejects an invalid body %j with 400', async (body) => {
      expect((await login(body)).status).toBe(400);
    });

    it('ignores client-sent role and status', async () => {
      const res = await login({
        email: `${ids.suspended}@gossip-society.example`,
        password: PASSWORD,
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      expect(res.status).toBe(403);

      const ok = await login({
        email: `${ids.influencer}@gossip-society.example`,
        password: PASSWORD,
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      const { accessToken, user } = loginResponseSchema.parse(await ok.json());
      expect(user.role).toBe('INFLUENCER');
      expect((await get('/probe/admin', accessToken)).status).toBe(403);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the caller’s safe profile', async () => {
      const res = await get('/auth/me', await tokenFor(ids.owner));
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).not.toContain('passwordHash');
      expect(safeUserSchema.parse(JSON.parse(text))).toMatchObject({
        id: ids.owner,
        role: 'VENUE_OWNER',
      });
    });

    it('rejects a missing, malformed or garbage Authorization header', async () => {
      expect((await get('/auth/me')).status).toBe(401);
      expect(
        (await get('/auth/me', undefined, { authorization: 'Basic abc' }))
          .status,
      ).toBe(401);
      expect(
        (await get('/auth/me', undefined, { authorization: 'Bearer' })).status,
      ).toBe(401);
      expect((await get('/auth/me', 'not.a.jwt')).status).toBe(401);
    });

    it('rejects an expired token', async () => {
      const { session } = await createSessionWithToken(fake, jwt, ids.admin);
      const expired = await jwt.signAsync(
        { sid: session.id, exp: Math.floor(Date.now() / 1000) - 10 },
        { subject: ids.admin },
      );
      expect((await get('/auth/me', expired)).status).toBe(401);
    });

    it('rejects a token signed with another secret', async () => {
      const { session } = await createSessionWithToken(fake, jwt, ids.admin);
      const forged = await new JwtService({
        secret: 'another-secret-another-secret-123456',
      }).signAsync(
        { sid: session.id, exp: inFifteenMinutes() },
        { subject: ids.admin },
      );
      expect((await get('/auth/me', forged)).status).toBe(401);
    });

    it('rejects a correctly signed token that has no exp', async () => {
      // A JwtService without an expiry setting signs tokens with no exp.
      const { session } = await createSessionWithToken(fake, jwt, ids.admin);
      const neverExpires = await new JwtService({
        secret: process.env.JWT_SECRET,
      }).signAsync({ sid: session.id }, { subject: ids.admin });
      expect(jwt.decode<{ exp?: number }>(neverExpires).exp).toBeUndefined();
      expect((await get('/auth/me', neverExpires)).status).toBe(401);
    });

    it('rejects an unsigned (alg none) token', async () => {
      const part = (value: object) =>
        Buffer.from(JSON.stringify(value)).toString('base64url');
      const unsigned = `${part({ alg: 'none', typ: 'JWT' })}.${part({ sub: ids.admin })}.`;
      expect((await get('/auth/me', unsigned)).status).toBe(401);
    });

    it('rejects a token whose subject is not a valid id', async () => {
      const { session } = await createSessionWithToken(fake, jwt, ids.admin);
      const bad = await jwt.signAsync(
        { sid: session.id, exp: inFifteenMinutes() },
        { subject: 'not-a-uuid' },
      );
      expect((await get('/auth/me', bad)).status).toBe(401);
    });

    it('rejects a token for a user that no longer exists', async () => {
      const token = await tokenFor(ids.influencer);
      users.delete(ids.influencer);
      expect((await get('/auth/me', token)).status).toBe(401);
    });

    it('rejects a valid token once the account is SUSPENDED', async () => {
      const token = await tokenFor(ids.influencer);
      expect((await get('/auth/me', token)).status).toBe(200);
      users.set(ids.influencer, {
        ...users.get(ids.influencer)!,
        status: 'SUSPENDED',
      });
      const res = await get('/auth/me', token);
      expect(res.status).toBe(403);
      expect(accountStatusErrorSchema.parse(await res.json()).code).toBe(
        'ACCOUNT_SUSPENDED',
      );
    });

    it('rejects a token for a PENDING account', async () => {
      const res = await get('/auth/me', await tokenFor(ids.pending));
      expect(res.status).toBe(403);
    });

    it('uses the current database role, not an earlier one', async () => {
      const token = await tokenFor(ids.owner);
      expect((await get('/probe/admin', token)).status).toBe(403);

      users.set(ids.owner, { ...users.get(ids.owner)!, role: 'ADMIN' });
      expect((await get('/probe/admin', token)).status).toBe(200);
      expect(
        safeUserSchema.parse(await (await get('/auth/me', token)).json()).role,
      ).toBe('ADMIN');

      users.set(ids.owner, { ...users.get(ids.owner)!, role: 'INFLUENCER' });
      expect((await get('/probe/admin', token)).status).toBe(403);
    });

    it('ignores role and status claims sent by the client', async () => {
      const token = await tokenFor(ids.influencer);
      const res = await get('/probe/admin?role=ADMIN&status=ACTIVE', token, {
        'x-user-role': 'ADMIN',
        'x-role': 'ADMIN',
      });
      expect(res.status).toBe(403);
    });

    it('ignores a role claim inside a validly signed token', async () => {
      const { session } = await createSessionWithToken(
        fake,
        jwt,
        ids.influencer,
      );
      const token = await jwt.signAsync(
        { role: 'ADMIN', sid: session.id, exp: inFifteenMinutes() },
        { subject: ids.influencer },
      );
      expect((await get('/probe/admin', token)).status).toBe(403);
    });
  });

  describe('guards', () => {
    it('keeps /health public', async () => {
      expect((await get('/health')).status).toBe(200);
    });

    it('protects routes by default and only opens @Public() ones', async () => {
      expect((await get('/probe/open')).status).toBe(200);
      expect((await get('/probe/plain')).status).toBe(401);
      expect(
        (await get('/probe/plain', await tokenFor(ids.influencer))).status,
      ).toBe(200);
    });

    it('allows only the listed roles', async () => {
      const [admin, owner, influencer] = await Promise.all(
        [ids.admin, ids.owner, ids.influencer].map(tokenFor),
      );
      expect((await get('/probe/admin', admin)).status).toBe(200);
      expect((await get('/probe/admin', owner)).status).toBe(403);
      expect((await get('/probe/admin', influencer)).status).toBe(403);

      expect((await get('/probe/owner-or-admin', admin)).status).toBe(200);
      expect((await get('/probe/owner-or-admin', owner)).status).toBe(200);
      expect((await get('/probe/owner-or-admin', influencer)).status).toBe(403);
    });

    it('rejects an unauthenticated caller before checking roles', async () => {
      expect((await get('/probe/admin')).status).toBe(401);
    });

    it('denies a route that is both @Public() and @Roles()', async () => {
      expect((await get('/probe/public-admin')).status).toBe(403);
      expect(
        (await get('/probe/public-admin', await tokenFor(ids.admin))).status,
      ).toBe(403);
    });
  });
});
