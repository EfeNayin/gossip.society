// Development-only helper behind `pnpm db:subscription:dev`.
//
// It creates a SAMPLE subscription package and gives one venue a subscription
// so the offer publishing flow can be tried locally. The numbers are made up
// for development: they are NOT the real packages, prices or quotas, which the
// consultancy has not decided yet.
//
// It only ever creates what is missing. An existing plan (found by name) and an
// existing subscription of the venue are left exactly as they are.

export const DEV_PLAN_NAME = 'Örnek Geliştirme Paketi';
export const DEV_ACTIVE_OFFER_QUOTA = 3;
export const DEV_MONTHLY_MATCH_QUOTA = 10;
export const DEV_PERIOD_DAYS = 90;

interface DevSubscriptionClient {
  venue: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string } | null>;
  };
  subscriptionPlan: {
    upsert(args: {
      where: { name: string };
      create: {
        name: string;
        activeOfferQuota: number;
        monthlyMatchQuota: number;
      };
      update: Record<string, never>;
    }): Promise<{ id: string }>;
  };
  subscription: {
    findFirst(args: {
      where: { venueId: string };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: { venueId: string; planId: string; startsAt: Date; endsAt: Date };
    }): Promise<{ id: string }>;
  };
}

export type DevSubscriptionResult =
  | { kind: 'venue-missing' }
  | { kind: 'already-subscribed' }
  | { kind: 'created'; planId: string; subscriptionId: string };

export async function ensureDevSubscription(
  prisma: DevSubscriptionClient,
  venueId: string,
  now: Date = new Date(),
  planName: string = DEV_PLAN_NAME,
): Promise<DevSubscriptionResult> {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) return { kind: 'venue-missing' };

  // A venue that already has any subscription is left alone (not even checked
  // for overlap): the development helper never changes existing data.
  if (await prisma.subscription.findFirst({ where: { venueId } })) {
    return { kind: 'already-subscribed' };
  }

  // `update: {}` keeps an existing plan with this name exactly as it is.
  const plan = await prisma.subscriptionPlan.upsert({
    where: { name: planName },
    create: {
      name: planName,
      activeOfferQuota: DEV_ACTIVE_OFFER_QUOTA,
      monthlyMatchQuota: DEV_MONTHLY_MATCH_QUOTA,
    },
    update: {},
  });
  const subscription = await prisma.subscription.create({
    data: {
      venueId,
      planId: plan.id,
      startsAt: now,
      endsAt: new Date(now.getTime() + DEV_PERIOD_DAYS * 24 * 3600 * 1000),
    },
  });
  return { kind: 'created', planId: plan.id, subscriptionId: subscription.id };
}
