import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { UserRole, UserStatus } from '@gossip/shared';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from './public.decorator.js';
import { Roles } from './roles.decorator.js';

export interface FakeUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function makeUser(
  overrides: Partial<FakeUser> & { id: string },
): FakeUser {
  return {
    email: `${overrides.id}@gossip-society.example`,
    name: 'Test User',
    role: 'INFLUENCER',
    status: 'ACTIVE',
    passwordHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface FakeSession {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  lastRefreshedAt: Date | null;
}

export interface FakeRefreshToken {
  id: string;
  sessionId: string;
  tokenHash: string;
  createdAt: Date;
  usedAt: Date | null;
}

type Where = Record<string, unknown>;

// Supports the conditions the auth code uses: equality, null and { gt }.
function matches(row: object, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as Record<string, unknown>)[key];
    if (expected !== null && typeof expected === 'object' && 'gt' in expected) {
      return (actual as Date) > (expected as { gt: Date }).gt;
    }
    return actual === expected;
  });
}

/**
 * In-memory stand-in for the parts of PrismaService the auth code uses.
 * $transaction restores a snapshot when the callback throws, like a rollback.
 * It does not model concurrency or row locks: those are covered by the
 * Postgres integration tests.
 */
export function createFakePrisma() {
  const users = new Map<string, FakeUser>();
  const sessions = new Map<string, FakeSession>();
  const refreshTokens = new Map<string, FakeRefreshToken>();

  const updateMany = <T extends object>(
    rows: Map<string, T>,
    { where, data }: { where: Where; data: Partial<T> },
  ) => {
    const found = [...rows.values()].filter((row) => matches(row, where));
    for (const row of found) Object.assign(row, data);
    return { count: found.length };
  };

  const withUser = (session: FakeSession | undefined) => {
    const user = session && users.get(session.userId);
    // A deleted user takes its sessions with it (ON DELETE CASCADE).
    return session && user ? { ...session, user } : null;
  };

  const $transaction = async <R>(
    fn: (tx: typeof models) => Promise<R>,
  ): Promise<R> => {
    const snapshot = {
      sessions: [...sessions].map(([id, row]) => [id, { ...row }] as const),
      refreshTokens: [...refreshTokens].map(
        ([id, row]) => [id, { ...row }] as const,
      ),
    };
    try {
      return await fn(models);
    } catch (error) {
      sessions.clear();
      for (const [id, row] of snapshot.sessions) sessions.set(id, row);
      refreshTokens.clear();
      for (const [id, row] of snapshot.refreshTokens)
        refreshTokens.set(id, row);
      throw error;
    }
  };

  const models = {
    user: {
      findUnique: async ({
        where,
      }: {
        where: { id?: string; email?: string };
      }) => {
        if (where.id) return users.get(where.id) ?? null;
        return [...users.values()].find((u) => u.email === where.email) ?? null;
      },
    },
    authSession: {
      create: async ({
        data,
      }: {
        data: { userId: string; expiresAt: Date };
      }) => {
        const session: FakeSession = {
          id: randomUUID(),
          createdAt: new Date(),
          revokedAt: null,
          lastRefreshedAt: null,
          ...data,
        };
        sessions.set(session.id, session);
        return session;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        withUser(sessions.get(where.id)),
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const found = withUser(sessions.get(where.id));
        if (!found) throw new Error('Not found');
        return found;
      },
      updateMany: async (args: { where: Where; data: Partial<FakeSession> }) =>
        updateMany(sessions, args),
    },
    refreshToken: {
      create: async ({
        data,
      }: {
        data: { sessionId: string; tokenHash: string };
      }) => {
        if (
          [...refreshTokens.values()].some(
            (t) => t.tokenHash === data.tokenHash,
          )
        ) {
          throw new Error('Unique constraint failed on tokenHash');
        }
        const token: FakeRefreshToken = {
          id: randomUUID(),
          createdAt: new Date(),
          usedAt: null,
          ...data,
        };
        refreshTokens.set(token.id, token);
        return token;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        [...refreshTokens.values()].find(
          (t) => t.tokenHash === where.tokenHash,
        ) ?? null,
      updateMany: async (args: {
        where: Where;
        data: Partial<FakeRefreshToken>;
      }) => updateMany(refreshTokens, args),
    },
    $queryRaw: async () => [{ '?column?': 1 }],
  };
  const prisma = { ...models, $transaction };
  return { users, sessions, refreshTokens, prisma };
}

/** Creates a live session for a user and returns a matching signed access token. */
export async function createSessionWithToken(
  fake: ReturnType<typeof createFakePrisma>,
  jwt: JwtService,
  userId: string,
  options: { expiresAt?: Date; accessTtlSeconds?: number } = {},
) {
  const session = await fake.prisma.authSession.create({
    data: {
      userId,
      expiresAt:
        options.expiresAt ?? new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  const exp = Math.floor(Date.now() / 1000) + (options.accessTtlSeconds ?? 900);
  const accessToken = await jwt.signAsync(
    { sid: session.id, exp },
    { subject: userId },
  );
  return { session, accessToken };
}

/** Routes that only exist in tests, to exercise the guards without real endpoints. */
@Controller('probe')
export class ProbeController {
  @Public()
  @Get('open')
  open() {
    return { ok: true };
  }

  // No decorators: proves the secure default.
  @Get('plain')
  plain() {
    return { ok: true };
  }

  @Roles('ADMIN')
  @Get('admin')
  admin() {
    return { ok: true };
  }

  @Roles('VENUE_OWNER', 'ADMIN')
  @Get('owner-or-admin')
  ownerOrAdmin() {
    return { ok: true };
  }

  @Public()
  @Roles('ADMIN')
  @Get('public-admin')
  publicAdmin() {
    return { ok: true };
  }
}

export async function createTestApp(
  fakePrisma: ReturnType<typeof createFakePrisma>['prisma'],
  configure: (
    builder: ReturnType<typeof Test.createTestingModule>,
  ) => void = () => {},
): Promise<{
  app: INestApplication;
  baseUrl: string;
  moduleRef: Awaited<
    ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>
  >;
}> {
  const builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: [ProbeController],
  })
    .overrideProvider(PrismaService)
    .useValue(fakePrisma);
  configure(builder);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, baseUrl: `http://127.0.0.1:${port}`, moduleRef };
}
