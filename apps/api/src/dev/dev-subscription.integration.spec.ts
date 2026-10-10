import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { ensureDevSubscription } from '../../prisma/dev-subscription.js';
import { env } from '../env.js';

// Against the real database, with a temporary owner/venue and a temporary plan
// name: the real seed venue and any real plan are never touched.
const RUN = randomUUID().slice(0, 8);
const PREFIX = `itest-devsub-${RUN}`;

describe('ensureDevSubscription on PostgreSQL', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
  let venueId: string;
  const planName = `${PREFIX}-plan`;

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: {
        email: `${PREFIX}@gossip-society.example`,
        name: 'Test',
        role: 'VENUE_OWNER',
        status: 'ACTIVE',
      },
    });
    venueId = (
      await prisma.venue.create({
        data: { name: `${PREFIX}-venue`, ownerId: owner.id },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { venueId } });
    await prisma.venue.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.subscriptionPlan.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it('creates a plan and a subscription once, and never changes an existing plan', async () => {
    // A plan with this name already exists with other numbers: it must stay as it is.
    await prisma.subscriptionPlan.create({
      data: { name: planName, activeOfferQuota: 42, monthlyMatchQuota: 7 },
    });

    const first = await ensureDevSubscription(
      prisma,
      venueId,
      new Date(),
      planName,
    );
    const second = await ensureDevSubscription(
      prisma,
      venueId,
      new Date(),
      planName,
    );

    expect(first.kind).toBe('created');
    expect(second.kind).toBe('already-subscribed');
    expect(await prisma.subscription.count({ where: { venueId } })).toBe(1);
    const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
      where: { name: planName },
    });
    expect(plan).toMatchObject({ activeOfferQuota: 42, monthlyMatchQuota: 7 });
  });

  it('reports a missing venue without creating anything', async () => {
    expect(
      (
        await ensureDevSubscription(
          prisma,
          randomUUID(),
          new Date(),
          `${PREFIX}-nobody`,
        )
      ).kind,
    ).toBe('venue-missing');
    expect(
      await prisma.subscriptionPlan.count({
        where: { name: `${PREFIX}-nobody` },
      }),
    ).toBe(0);
  });
});
