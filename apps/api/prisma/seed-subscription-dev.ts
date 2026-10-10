// Development-only. Run on demand with `pnpm db:subscription:dev` (after
// `pnpm db:seed:dev`); never wired into migrations, CI or deployment, and it
// refuses to run with NODE_ENV=production.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  DEV_ACTIVE_OFFER_QUOTA,
  DEV_PERIOD_DAYS,
  DEV_PLAN_NAME,
  ensureDevSubscription,
} from './dev-subscription.js';
import { databaseUrl } from './dev-database-url.js';
import { SEED_VENUE_ID } from './seed-users.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Refusing to run the development subscription helper with NODE_ENV=production.',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

try {
  const result = await ensureDevSubscription(prisma, SEED_VENUE_ID);
  if (result.kind === 'venue-missing') {
    console.log(
      'The example venue does not exist yet: run `pnpm db:seed:dev` first. Nothing was changed.',
    );
  } else if (result.kind === 'already-subscribed') {
    console.log(
      'The example venue already has a subscription. Nothing was changed.',
    );
  } else {
    console.log(
      `Gave the example venue a ${DEV_PERIOD_DAYS}-day subscription to the sample plan "${DEV_PLAN_NAME}" ` +
        `(active offer quota ${DEV_ACTIVE_OFFER_QUOTA}). These numbers are made up for development; ` +
        'they are not real packages or quotas.',
    );
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
