import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { loginResponseSchema, type UserRole } from '@gossip/shared';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CLOCK } from './collaboration.service.js';

// Shared set-up of the collaboration tests that run against the real
// PostgreSQL. Everything it creates is tied to e-mails / names starting with
// `itest-<label>-<run>` and `close()` removes exactly that. Seed accounts,
// venues, plans and offers are never read or changed.
export const DAY = 24 * 3600 * 1000;
export const at = (offsetMs: number) => new Date(Date.now() + offsetMs);
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
const PASSWORD = 'integration-test-password';

export async function createKit(label: string) {
  const run = randomUUID().slice(0, 8);
  const prefix = `itest-${label}-${run}-`;
  // The collaboration rules read this clock (after the locks). `fixed` makes a
  // test choose "now" (month boundaries); otherwise it is the real time.
  const clock: { fixed: Date | null } = { fixed: null };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(() => clock.fixed ?? new Date())
    .compile();
  const app: INestApplication = moduleRef.createNestApplication();
  await app.listen(0, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  const prisma = moduleRef.get(PrismaService);

  const tokens = new Map<string, string>();
  const userIds = new Map<string, string>();
  const email = (name: string) =>
    `${prefix}${name.toLowerCase()}@gossip-society.example`;

  const request = (
    method: string,
    path: string,
    who: string | null,
    payload?: unknown,
  ) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(payload === undefined
          ? {}
          : { 'content-type': 'application/json' }),
        ...(who ? { authorization: `Bearer ${tokens.get(who)}` } : {}),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });

  async function makeUser(
    name: string,
    role: UserRole,
    options: { profile?: boolean } = {},
  ) {
    const user = await prisma.user.create({
      data: {
        email: email(name),
        name: `Test ${name}`,
        role,
        status: 'ACTIVE',
        passwordHash: await hash(PASSWORD),
        ...(options.profile
          ? {
              influencerProfile: {
                create: {
                  city: 'İstanbul',
                  bio: `${name} yemek içerikleri üretir`,
                  instagramUsername: `${prefix}${name}`.slice(0, 40),
                },
              },
            }
          : {}),
      },
    });
    userIds.set(name, user.id);
    const res = await request('POST', '/auth/login', null, {
      email: email(name),
      password: PASSWORD,
    });
    tokens.set(name, loginResponseSchema.parse(await res.json()).accessToken);
    return user;
  }

  async function makeVenue(ownerName: string, name: string, branches = 1) {
    const venue = await prisma.venue.create({
      data: {
        name: `${prefix}${name}`,
        ownerId: userIds.get(ownerName)!,
        branches: {
          create: Array.from({ length: branches }, (_v, i) => ({
            name: `Şube ${i + 1}`,
            city: 'İstanbul',
            address: `Adres ${i + 1}`,
          })),
        },
      },
      include: { branches: { orderBy: { name: 'asc' } } },
    });
    return { venueId: venue.id, branchIds: venue.branches.map((b) => b.id) };
  }

  let planCount = 0;
  async function subscribe(
    venueId: string,
    monthlyQuota: number,
    startsAt = at(-60 * DAY),
    endsAt = at(60 * DAY),
  ) {
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: `${prefix}plan-${++planCount}`,
        activeOfferQuota: 100,
        monthlyMatchQuota: monthlyQuota,
      },
    });
    return prisma.subscription.create({
      data: { venueId, planId: plan.id, startsAt, endsAt },
    });
  }

  // A published offer that is open now (unless overridden).
  const makeOffer = (
    branchId: string,
    overrides: Record<string, unknown> = {},
  ) =>
    prisma.offer.create({
      data: {
        branchId,
        title: `${prefix}ilan`,
        description: 'İki kişilik akşam yemeği daveti',
        serviceDescription: 'İki kişilik tadım menüsü',
        serviceValueKurus: 250_000,
        expectedContent: 'Bir reels ve üç story',
        minFollowers: 5000,
        capacity: 5,
        validFrom: at(-DAY),
        validUntil: at(30 * DAY),
        status: 'PUBLISHED',
        publishedAt: at(-DAY),
        ...overrides,
      },
    });

  /** An application written directly (to set up a state without going through the API). */
  async function insertCollaboration(options: {
    offerId: string;
    influencerName: string;
    ownerName?: string;
    status?: 'APPLIED' | 'APPROVED' | 'REJECTED';
    approvedAt?: Date;
    appliedAt?: Date;
  }) {
    const offer = await prisma.offer.findUniqueOrThrow({
      where: { id: options.offerId },
      include: { branch: true },
    });
    const status = options.status ?? 'APPLIED';
    const appliedAt =
      options.appliedAt ??
      new Date((options.approvedAt ?? new Date()).getTime() - 3600 * 1000);
    const decidedAt =
      status === 'APPLIED'
        ? null
        : (options.approvedAt ?? new Date(appliedAt.getTime() + 1000));
    const actorId = userIds.get(options.influencerName)!;
    const decider = options.ownerName ? userIds.get(options.ownerName)! : null;
    const created = await prisma.collaboration.create({
      data: {
        offerId: offer.id,
        influencerId: actorId,
        venueId: offer.branch.venueId,
        status,
        appliedAt,
        termsAcceptedAt: appliedAt,
        termsSnapshot: {
          title: offer.title,
          serviceDescription: offer.serviceDescription,
          serviceValueKurus: offer.serviceValueKurus,
          expectedContent: offer.expectedContent,
          minFollowers: offer.minFollowers,
          validFrom: offer.validFrom.toISOString(),
          validUntil: offer.validUntil.toISOString(),
        },
        decidedAt,
        decidedById: status === 'APPLIED' ? null : decider,
        approvedAt:
          status === 'APPROVED' ? (options.approvedAt ?? decidedAt) : null,
      },
    });
    await prisma.collaborationEvent.create({
      data: {
        collaborationId: created.id,
        fromStatus: null,
        toStatus: 'APPLIED',
        actorId,
        createdAt: appliedAt,
      },
    });
    if (status !== 'APPLIED') {
      await prisma.collaborationEvent.create({
        data: {
          collaborationId: created.id,
          fromStatus: 'APPLIED',
          toStatus: status,
          actorId: decider!,
          createdAt: decidedAt!,
        },
      });
    }
    return created;
  }

  const events = (collaborationId: string) =>
    prisma.collaborationEvent.findMany({
      where: { collaborationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

  async function close() {
    const owners = { owner: { email: { startsWith: prefix } } };
    const ownedVenues = { venue: owners };
    await prisma.collaboration.deleteMany({ where: ownedVenues }); // events cascade
    await prisma.offer.deleteMany({ where: { branch: ownedVenues } });
    await prisma.subscription.deleteMany({ where: ownedVenues });
    await prisma.venue.deleteMany({ where: owners });
    await prisma.subscriptionPlan.deleteMany({
      where: { name: { startsWith: prefix } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await app.close();
  }

  return {
    app,
    baseUrl,
    prisma,
    prefix,
    run,
    clock,
    tokens,
    userIds,
    email,
    request,
    makeUser,
    makeVenue,
    subscribe,
    makeOffer,
    insertCollaboration,
    events,
    close,
  };
}
export type Kit = Awaited<ReturnType<typeof createKit>>;

// Waits until PostgreSQL reports `count` backends blocked on a lock whose
// current statement matches `pattern` (an ILIKE pattern).
export async function waitBlocked(
  prisma: PrismaService,
  pattern: string,
  count = 1,
): Promise<void> {
  for (let i = 0; i < 400; i++) {
    const rows = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND query ILIKE ${pattern}`;
    if (rows[0]!.n >= count) return;
    await sleep(25);
  }
  throw new Error(`nothing blocked on ${pattern}`);
}
