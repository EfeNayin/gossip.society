import { hash } from '@node-rs/argon2';
import { seedUserEmails } from './seed-users.js';

interface PasswordClient {
  user: {
    updateMany(args: {
      where: { email: string; passwordHash: null };
      data: { passwordHash: string };
    }): Promise<{ count: number }>;
  };
}

export const MIN_DEV_PASSWORD_LENGTH = 12;

/**
 * Hashes `password` with argon2id for each seed account that has no password
 * yet. The `passwordHash: null` filter is part of the UPDATE itself, so an
 * existing hash is never overwritten, and only passwordHash is ever written:
 * roles and statuses are untouched.
 */
export async function setDevPasswords(
  prisma: PasswordClient,
  password: string,
) {
  if (password.length < MIN_DEV_PASSWORD_LENGTH) {
    throw new Error(
      `DEV_SEED_PASSWORD must be at least ${MIN_DEV_PASSWORD_LENGTH} characters.`,
    );
  }

  let updated = 0;
  for (const email of seedUserEmails) {
    const { count } = await prisma.user.updateMany({
      where: { email, passwordHash: null },
      data: { passwordHash: await hash(password) },
    });
    updated += count;
  }
  return { updated, skipped: seedUserEmails.length - updated };
}
