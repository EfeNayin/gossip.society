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

export interface FakeVenue {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeBranch {
  id: string;
  venueId: string;
  name: string;
  city: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

type Where = Record<string, unknown>;

type OrderBy = Record<string, 'asc' | 'desc'>[];

function sortRows<T extends object>(rows: T[], orderBy: OrderBy = []): T[] {
  return [...rows].sort((a, b) => {
    for (const rule of orderBy) {
      const [[key, direction]] = Object.entries(rule) as [
        [string, 'asc' | 'desc'],
      ];
      const left = (a as Record<string, unknown>)[key] as string | Date;
      const right = (b as Record<string, unknown>)[key] as string | Date;
      if (left < right) return direction === 'asc' ? -1 : 1;
      if (left > right) return direction === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

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
  const venues = new Map<string, FakeVenue>();
  const branches = new Map<string, FakeBranch>();
  // Each created row gets a later timestamp, so ordering tests are deterministic.
  let clock = Date.UTC(2026, 9, 10, 12, 0, 0);
  const tick = () => new Date((clock += 1000));
  // Tests set this to make the next venue insert fail (after the user insert).
  const failures: { venueCreate?: Error } = {};

  const venueView = (
    venue: FakeVenue,
    include: { owner?: unknown; branches?: { orderBy?: OrderBy } },
  ) => ({
    ...venue,
    ...(include.owner ? { owner: users.get(venue.ownerId) } : {}),
    ...(include.branches
      ? {
          branches: sortRows(
            [...branches.values()].filter((b) => b.venueId === venue.id),
            include.branches.orderBy,
          ),
        }
      : {}),
  });

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
      users: [...users].map(([id, row]) => [id, { ...row }] as const),
      venues: [...venues].map(([id, row]) => [id, { ...row }] as const),
      branches: [...branches].map(([id, row]) => [id, { ...row }] as const),
      sessions: [...sessions].map(([id, row]) => [id, { ...row }] as const),
      refreshTokens: [...refreshTokens].map(
        ([id, row]) => [id, { ...row }] as const,
      ),
    };
    try {
      return await fn(models);
    } catch (error) {
      users.clear();
      for (const [id, row] of snapshot.users) users.set(id, row);
      venues.clear();
      for (const [id, row] of snapshot.venues) venues.set(id, row);
      branches.clear();
      for (const [id, row] of snapshot.branches) branches.set(id, row);
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
      create: async ({
        data,
      }: {
        data: Pick<
          FakeUser,
          'email' | 'name' | 'role' | 'status' | 'passwordHash'
        >;
      }) => {
        if ([...users.values()].some((u) => u.email === data.email)) {
          // What Prisma throws for the unique e-mail constraint.
          throw Object.assign(new Error('Unique constraint failed on email'), {
            code: 'P2002',
          });
        }
        const user: FakeUser = {
          id: randomUUID(),
          createdAt: tick(),
          updatedAt: tick(),
          ...data,
        };
        users.set(user.id, user);
        return user;
      },
    },
    venue: {
      create: async ({
        data,
        include,
      }: {
        data: {
          name: string;
          description: string | null;
          ownerId: string;
          branches: { create: Pick<FakeBranch, 'name' | 'city' | 'address'> };
        };
        include: Parameters<typeof venueView>[1];
      }) => {
        if (failures.venueCreate) throw failures.venueCreate;
        const venue: FakeVenue = {
          id: randomUUID(),
          name: data.name,
          description: data.description,
          ownerId: data.ownerId,
          createdAt: tick(),
          updatedAt: tick(),
        };
        venues.set(venue.id, venue);
        const branch: FakeBranch = {
          id: randomUUID(),
          venueId: venue.id,
          createdAt: tick(),
          updatedAt: tick(),
          ...data.branches.create,
        };
        branches.set(branch.id, branch);
        return venueView(venue, include);
      },
      findMany: async ({
        where,
        orderBy,
        skip = 0,
        take,
        include,
      }: {
        where?: Where;
        orderBy?: OrderBy;
        skip?: number;
        take?: number;
        include: Parameters<typeof venueView>[1];
      }) => {
        const rows = sortRows(
          [...venues.values()].filter((v) => !where || matches(v, where)),
          orderBy,
        );
        return rows
          .slice(skip, take === undefined ? undefined : skip + take)
          .map((v) => venueView(v, include));
      },
      count: async () => venues.size,
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
  return { users, sessions, refreshTokens, venues, branches, failures, prisma };
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
