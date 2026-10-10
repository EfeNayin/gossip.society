import {
  DEV_ACTIVE_OFFER_QUOTA,
  DEV_MONTHLY_MATCH_QUOTA,
  DEV_PERIOD_DAYS,
  DEV_PLAN_NAME,
  ensureDevSubscription,
} from '../../prisma/dev-subscription.js';

interface Plan {
  id: string;
  name: string;
  activeOfferQuota: number;
  monthlyMatchQuota: number;
}
interface Sub {
  id: string;
  venueId: string;
  planId: string;
  startsAt: Date;
  endsAt: Date;
}

function createFake(venueIds: string[]) {
  const plans = new Map<string, Plan>();
  const subs: Sub[] = [];
  let n = 0;
  const client = {
    venue: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        venueIds.includes(where.id) ? { id: where.id } : null,
    },
    subscriptionPlan: {
      upsert: async ({
        where,
        create,
      }: {
        where: { name: string };
        create: Omit<Plan, 'id'>;
        update: Record<string, never>;
      }) => {
        const existing = plans.get(where.name);
        if (existing) return existing; // update: {} changes nothing
        const plan = { id: `plan-${++n}`, ...create };
        plans.set(plan.name, plan);
        return plan;
      },
    },
    subscription: {
      findFirst: async ({ where }: { where: { venueId: string } }) =>
        subs.find((s) => s.venueId === where.venueId) ?? null,
      create: async ({ data }: { data: Omit<Sub, 'id'> }) => {
        const sub = { id: `sub-${++n}`, ...data };
        subs.push(sub);
        return sub;
      },
    },
  };
  return { client, plans, subs };
}

describe('ensureDevSubscription', () => {
  const now = new Date('2026-10-10T12:00:00.000Z');

  it('creates the sample plan and a subscription for the venue', async () => {
    const fake = createFake(['v1']);

    const result = await ensureDevSubscription(fake.client, 'v1', now);

    expect(result.kind).toBe('created');
    expect([...fake.plans.values()]).toEqual([
      {
        id: expect.any(String),
        name: DEV_PLAN_NAME,
        activeOfferQuota: DEV_ACTIVE_OFFER_QUOTA,
        monthlyMatchQuota: DEV_MONTHLY_MATCH_QUOTA,
      },
    ]);
    expect(fake.subs).toHaveLength(1);
    expect(fake.subs[0]!.startsAt).toEqual(now);
    expect(fake.subs[0]!.endsAt.getTime() - now.getTime()).toBe(
      DEV_PERIOD_DAYS * 24 * 3600 * 1000,
    );
  });

  it('is a no-op the second time', async () => {
    const fake = createFake(['v1']);
    await ensureDevSubscription(fake.client, 'v1', now);

    expect((await ensureDevSubscription(fake.client, 'v1', now)).kind).toBe(
      'already-subscribed',
    );

    expect(fake.subs).toHaveLength(1);
    expect(fake.plans.size).toBe(1);
  });

  it('never changes an existing plan with the same name', async () => {
    const fake = createFake(['v1']);
    fake.plans.set(DEV_PLAN_NAME, {
      id: 'mine',
      name: DEV_PLAN_NAME,
      activeOfferQuota: 99,
      monthlyMatchQuota: 1,
    });

    await ensureDevSubscription(fake.client, 'v1', now);

    expect(fake.plans.get(DEV_PLAN_NAME)).toEqual({
      id: 'mine',
      name: DEV_PLAN_NAME,
      activeOfferQuota: 99,
      monthlyMatchQuota: 1,
    });
    expect(fake.subs[0]!.planId).toBe('mine');
  });

  it('leaves a venue that already has any subscription alone', async () => {
    const fake = createFake(['v1']);
    fake.subs.push({
      id: 'old',
      venueId: 'v1',
      planId: 'x',
      startsAt: new Date(0),
      endsAt: new Date(1),
    });

    expect((await ensureDevSubscription(fake.client, 'v1', now)).kind).toBe(
      'already-subscribed',
    );

    expect(fake.subs).toHaveLength(1);
    expect(fake.plans.size).toBe(0); // not even the plan was created
  });

  it('does nothing when the venue does not exist', async () => {
    const fake = createFake([]);
    expect((await ensureDevSubscription(fake.client, 'nope', now)).kind).toBe(
      'venue-missing',
    );
    expect(fake.plans.size + fake.subs.length).toBe(0);
  });
});
