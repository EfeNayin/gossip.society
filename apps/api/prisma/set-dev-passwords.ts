// Development-only. Run on demand with `pnpm db:passwords:dev` after
// `pnpm db:seed:dev`; never wired into migrations, CI or deployment.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { databaseUrl } from './dev-database-url.js';
import { setDevPasswords } from './dev-passwords.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Refusing to set development passwords with NODE_ENV=production.',
  );
}

const password = process.env.DEV_SEED_PASSWORD;
if (!password) {
  throw new Error(
    'Set DEV_SEED_PASSWORD in the environment first (see README).',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

try {
  const { updated, skipped } = await setDevPasswords(prisma, password);
  console.log(
    `Dev passwords: ${updated} account(s) updated, ${skipped} skipped (already have a password, or not seeded).`,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
