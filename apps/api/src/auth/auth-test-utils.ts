import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { UserRole, UserStatus } from '@gossip/shared';
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

/** Minimal in-memory stand-in for the parts of PrismaService the auth code uses. */
export function createFakePrisma() {
  const users = new Map<string, FakeUser>();
  const prisma = {
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
    $queryRaw: async () => [{ '?column?': 1 }],
  };
  return { users, prisma };
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
