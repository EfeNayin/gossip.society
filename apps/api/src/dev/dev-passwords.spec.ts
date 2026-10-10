import { verify } from '@node-rs/argon2';
import { MAX_PASSWORD_LENGTH } from '@gossip/shared';
import {
  MIN_DEV_PASSWORD_LENGTH,
  setDevPasswords,
} from '../../prisma/dev-passwords.js';
import { seedUserEmails } from '../../prisma/seed-users.js';

interface Row {
  email: string;
  role: string;
  status: string;
  passwordHash: string | null;
}

// Mimics Prisma's updateMany: rows matching `where` get only the `data` fields.
function createFakePrisma(rows: Row[]) {
  return {
    user: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { email: string; passwordHash: null };
        data: { passwordHash: string };
      }) => {
        const matches = rows.filter(
          (row) =>
            row.email === where.email &&
            row.passwordHash === where.passwordHash,
        );
        for (const row of matches) Object.assign(row, data);
        return { count: matches.length };
      },
    },
  };
}

const PASSWORD = 'a-dev-only-password-123';

describe('setDevPasswords', () => {
  it('hashes the password with argon2id for seed accounts without one', async () => {
    const rows: Row[] = seedUserEmails.map((email) => ({
      email,
      role: 'INFLUENCER',
      status: 'ACTIVE',
      passwordHash: null,
    }));

    const result = await setDevPasswords(createFakePrisma(rows), PASSWORD);

    expect(result).toEqual({ updated: seedUserEmails.length, skipped: 0 });
    for (const row of rows) {
      expect(row.passwordHash).toMatch(/^\$argon2id\$/);
      expect(row.passwordHash).not.toContain(PASSWORD);
      expect(await verify(row.passwordHash!, PASSWORD)).toBe(true);
    }
  });

  it('keeps existing hashes, roles and statuses, and ignores non-seed accounts', async () => {
    const [first, second, third] = seedUserEmails as [string, string, string];
    const rows: Row[] = [
      { email: first, role: 'ADMIN', status: 'SUSPENDED', passwordHash: null },
      {
        email: second,
        role: 'VENUE_OWNER',
        status: 'PENDING',
        passwordHash: '$argon2id$existing',
      },
      {
        email: third,
        role: 'VENUE_STAFF',
        status: 'ACTIVE',
        passwordHash: null,
      },
      {
        email: 'real.person@example.com',
        role: 'ADMIN',
        status: 'ACTIVE',
        passwordHash: null,
      },
    ];
    const before = structuredClone(rows);

    const result = await setDevPasswords(createFakePrisma(rows), PASSWORD);

    expect(result.updated).toBe(2);
    expect(rows[1]).toEqual(before[1]); // existing hash untouched
    expect(rows[3]).toEqual(before[3]); // not a seed e-mail
    for (const index of [0, 2]) {
      expect(rows[index]!.passwordHash).toMatch(/^\$argon2id\$/);
      expect(rows[index]!.role).toBe(before[index]!.role);
      expect(rows[index]!.status).toBe(before[index]!.status);
    }
  });

  it('does nothing on a second run', async () => {
    const rows: Row[] = seedUserEmails.map((email) => ({
      email,
      role: 'INFLUENCER',
      status: 'ACTIVE',
      passwordHash: null,
    }));
    const prisma = createFakePrisma(rows);
    await setDevPasswords(prisma, PASSWORD);
    const afterFirst = structuredClone(rows);

    const result = await setDevPasswords(prisma, 'another-password-456');

    expect(result.updated).toBe(0);
    expect(rows).toEqual(afterFirst);
  });

  it('accepts a password of exactly the maximum login length', async () => {
    const rows: Row[] = [
      {
        email: seedUserEmails[0]!,
        role: 'ADMIN',
        status: 'ACTIVE',
        passwordHash: null,
      },
    ];
    const password = 'x'.repeat(MAX_PASSWORD_LENGTH);

    const result = await setDevPasswords(createFakePrisma(rows), password);

    expect(result.updated).toBe(1);
    expect(await verify(rows[0]!.passwordHash!, password)).toBe(true);
  });

  it('refuses a password longer than login accepts, without touching the database', async () => {
    const rows: Row[] = seedUserEmails.map((email) => ({
      email,
      role: 'INFLUENCER',
      status: 'ACTIVE',
      passwordHash: null,
    }));
    const before = structuredClone(rows);
    const prisma = createFakePrisma(rows);
    const updateMany = vi.spyOn(prisma.user, 'updateMany');

    await expect(
      setDevPasswords(prisma, 'x'.repeat(MAX_PASSWORD_LENGTH + 1)),
    ).rejects.toThrow(/12-256/);

    expect(updateMany).not.toHaveBeenCalled();
    expect(rows).toEqual(before);
  });

  it('refuses a short password', async () => {
    const prisma = createFakePrisma([]);
    await expect(
      setDevPasswords(prisma, 'x'.repeat(MIN_DEV_PASSWORD_LENGTH - 1)),
    ).rejects.toThrow(/12-256/);
  });
});
