import { UserRole } from '../src/generated/prisma/client.js';

// Shared by the development seed and the dev password command, so both only
// ever touch the same fixed set of accounts. The seed creates them without a
// password (passwordHash stays null); `pnpm db:passwords:dev` sets one.
export const seedUsers = {
  admin: {
    email: 'admin@gossip-society.example',
    name: 'Dev Admin',
    role: UserRole.ADMIN,
  },
  owner: {
    email: 'owner@gossip-society.example',
    name: 'Dev Venue Owner',
    role: UserRole.VENUE_OWNER,
  },
  staff: {
    email: 'staff@gossip-society.example',
    name: 'Dev Venue Staff',
    role: UserRole.VENUE_STAFF,
  },
  activeInfluencer: {
    email: 'influencer@gossip-society.example',
    name: 'Dev Influencer',
    role: UserRole.INFLUENCER,
  },
  pendingInfluencer: {
    email: 'pending-influencer@gossip-society.example',
    name: 'Dev Pending Influencer',
    role: UserRole.INFLUENCER,
  },
} as const;

export const seedUserEmails: string[] = Object.values(seedUsers).map(
  (user) => user.email,
);
