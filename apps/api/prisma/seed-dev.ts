// Development-only seed. Run on demand with `pnpm db:seed:dev`; never wired into
// migrations, CI or deployment. Safe to re-run: every record is created only
// if missing and existing rows are never updated or deleted.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../src/generated/prisma/client.js';
import { databaseUrl } from './dev-database-url.js';
import { SEED_VENUE_ID as VENUE_ID, seedUsers as users } from './seed-users.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Refusing to run the development seed with NODE_ENV=production.',
  );
}

// Fixed ids let re-runs find the venue and branches without extra unique keys.
const BRANCH_KADIKOY_ID = '00000000-0000-4000-8000-000000000201';
const BRANCH_BESIKTAS_ID = '00000000-0000-4000-8000-000000000202';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

// `update: {}` keeps an existing user untouched (status included). The role
// check stops the seed from attaching relations to an account that was changed
// to a different role since the last run.
async function ensureUser(
  seedUser: { email: string; name: string; role: UserRole },
  status: 'ACTIVE' | 'PENDING',
) {
  const user = await prisma.user.upsert({
    where: { email: seedUser.email },
    create: { ...seedUser, status },
    update: {},
  });
  if (user.role !== seedUser.role) {
    throw new Error(
      `${seedUser.email} exists with role ${user.role}, expected ${seedUser.role}.`,
    );
  }
  return user;
}

async function main() {
  const admin = await ensureUser(users.admin, 'ACTIVE');
  const owner = await ensureUser(users.owner, 'ACTIVE');
  const staff = await ensureUser(users.staff, 'ACTIVE');
  const activeInfluencer = await ensureUser(users.activeInfluencer, 'ACTIVE');
  const pendingInfluencer = await ensureUser(
    users.pendingInfluencer,
    'PENDING',
  );

  await prisma.influencerProfile.upsert({
    where: { userId: activeInfluencer.id },
    create: {
      userId: activeInfluencer.id,
      city: 'İstanbul',
      bio: 'Geliştirme ortamı için örnek influencer profili.',
      instagramUsername: 'dev_influencer',
    },
    update: {},
  });
  await prisma.influencerProfile.upsert({
    where: { userId: pendingInfluencer.id },
    create: { userId: pendingInfluencer.id, city: 'Ankara' },
    update: {},
  });

  await prisma.venue.upsert({
    where: { id: VENUE_ID },
    create: {
      id: VENUE_ID,
      name: 'Örnek Kafe',
      description: 'Geliştirme ortamı için örnek mekan.',
      ownerId: owner.id,
    },
    update: {},
  });

  const branches = [
    {
      id: BRANCH_KADIKOY_ID,
      name: 'Kadıköy',
      address: 'Örnek Sokak No: 1, Kadıköy',
    },
    {
      id: BRANCH_BESIKTAS_ID,
      name: 'Beşiktaş',
      address: 'Örnek Cadde No: 2, Beşiktaş',
    },
  ];
  for (const branch of branches) {
    await prisma.venueBranch.upsert({
      where: { id: branch.id },
      create: { ...branch, venueId: VENUE_ID, city: 'İstanbul' },
      update: {},
    });
  }

  // Staff works at the Kadıköy branch only.
  await prisma.venueStaff.upsert({
    where: {
      userId_branchId: { userId: staff.id, branchId: BRANCH_KADIKOY_ID },
    },
    create: { userId: staff.id, branchId: BRANCH_KADIKOY_ID },
    update: {},
  });

  console.log(`Development seed done (admin: ${admin.email}).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
