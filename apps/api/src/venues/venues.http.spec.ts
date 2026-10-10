import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verify } from '@node-rs/argon2';
import {
  adminVenueListSchema,
  adminVenueSchema,
  emailConflictErrorSchema,
  myVenuesResponseSchema,
  type UserRole,
} from '@gossip/shared';
import {
  createFakePrisma,
  createSessionWithToken,
  createTestApp,
  makeUser,
} from '../auth/auth-test-utils.js';

const PASSWORD = 'a-long-initial-password';
const ids = {
  admin: '00000000-0000-4000-8000-0000000000d1',
  suspendedAdmin: '00000000-0000-4000-8000-0000000000d2',
  influencer: '00000000-0000-4000-8000-0000000000d3',
  staff: '00000000-0000-4000-8000-0000000000d4',
  ownerA: '00000000-0000-4000-8000-0000000000d5',
  ownerB: '00000000-0000-4000-8000-0000000000d6',
};

const body = (overrides: Record<string, unknown> = {}) => ({
  owner: {
    name: 'Ayşe Yılmaz',
    email: 'ayse@kafe.example',
    password: PASSWORD,
  },
  venue: { name: 'Örnek Kafe', description: 'Kadıköy’de bir kafe' },
  branch: { name: 'Kadıköy', city: 'İstanbul', address: 'Örnek Sokak No: 1' },
  ...overrides,
});

describe('venues over HTTP', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtService;
  let fake: ReturnType<typeof createFakePrisma>;
  const tokens = new Map<string, string>();

  const call = (
    method: string,
    path: string,
    token?: string,
    payload?: unknown,
  ) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(payload === undefined
          ? {}
          : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
  const create = (payload: unknown, who: keyof typeof ids | null = 'admin') =>
    call('POST', '/admin/venues', who ? tokens.get(who) : undefined, payload);
  const list = (query = '', who: keyof typeof ids | null = 'admin') =>
    call('GET', `/admin/venues${query}`, who ? tokens.get(who) : undefined);
  const mine = (who: keyof typeof ids | null, query = '') =>
    call('GET', `/venues/mine${query}`, who ? tokens.get(who) : undefined);

  beforeEach(async () => {
    fake = createFakePrisma();
    const roles: [keyof typeof ids, UserRole, 'ACTIVE' | 'SUSPENDED'][] = [
      ['admin', 'ADMIN', 'ACTIVE'],
      ['suspendedAdmin', 'ADMIN', 'SUSPENDED'],
      ['influencer', 'INFLUENCER', 'ACTIVE'],
      ['staff', 'VENUE_STAFF', 'ACTIVE'],
      ['ownerA', 'VENUE_OWNER', 'ACTIVE'],
      ['ownerB', 'VENUE_OWNER', 'ACTIVE'],
    ];
    for (const [key, role, status] of roles) {
      fake.users.set(ids[key], makeUser({ id: ids[key], role, status }));
    }
    const created = await createTestApp(fake.prisma);
    app = created.app;
    baseUrl = created.baseUrl;
    jwt = created.moduleRef.get(JwtService);
    for (const key of Object.keys(ids) as (keyof typeof ids)[]) {
      tokens.set(
        key,
        (await createSessionWithToken(fake, jwt, ids[key])).accessToken,
      );
    }
  });

  afterEach(() => app.close());

  describe('POST /admin/venues', () => {
    it('creates an ACTIVE VENUE_OWNER, the venue and the first branch', async () => {
      const res = await create(body());

      expect(res.status).toBe(201);
      const text = await res.text();
      const venue = adminVenueSchema.parse(JSON.parse(text));
      expect(venue).toMatchObject({
        name: 'Örnek Kafe',
        description: 'Kadıköy’de bir kafe',
        owner: {
          name: 'Ayşe Yılmaz',
          email: 'ayse@kafe.example',
          status: 'ACTIVE',
        },
        branches: [
          { name: 'Kadıköy', city: 'İstanbul', address: 'Örnek Sokak No: 1' },
        ],
      });

      const owner = [...fake.users.values()].find(
        (u) => u.email === 'ayse@kafe.example',
      )!;
      expect(owner).toMatchObject({ role: 'VENUE_OWNER', status: 'ACTIVE' });
      expect(fake.venues.get(venue.id)!.ownerId).toBe(owner.id);
      expect([...fake.branches.values()]).toHaveLength(1);

      // The password is only stored as a verifiable argon2id hash and never comes back.
      expect(owner.passwordHash).toMatch(/^\$argon2id\$/);
      expect(await verify(owner.passwordHash!, PASSWORD)).toBe(true);
      expect(text).not.toContain(PASSWORD);
      expect(text).not.toMatch(/argon2|passwordHash/);
      expect(JSON.stringify([...fake.users.values()])).not.toContain(PASSWORD);
    });

    it('normalizes the e-mail (trim + lowercase) and keeps the password untrimmed', async () => {
      const password = '  spaces and Case 123  ';
      const res = await create(
        body({
          owner: { name: 'Ayşe', email: '  Ayse@Kafe.EXAMPLE ', password },
        }),
      );

      expect(res.status).toBe(201);
      const owner = [...fake.users.values()].find(
        (u) => u.email === 'ayse@kafe.example',
      )!;
      expect(await verify(owner.passwordHash!, password)).toBe(true);
      expect(await verify(owner.passwordHash!, password.trim())).toBe(false);
    });

    it('works without a description', async () => {
      const res = await create(body({ venue: { name: 'Sadece Ad' } }));
      expect(res.status).toBe(201);
      expect(adminVenueSchema.parse(await res.json()).description).toBeNull();
    });

    it('ignores client-sent role, status and ownerId', async () => {
      const res = await create({
        ...body(),
        role: 'ADMIN',
        status: 'SUSPENDED',
        ownerId: ids.admin,
        owner: {
          ...body().owner,
          role: 'ADMIN',
          status: 'SUSPENDED',
          id: ids.admin,
        },
        venue: { ...body().venue, ownerId: ids.admin },
      });

      expect(res.status).toBe(201);
      const owner = [...fake.users.values()].find(
        (u) => u.email === 'ayse@kafe.example',
      )!;
      expect(owner).toMatchObject({ role: 'VENUE_OWNER', status: 'ACTIVE' });
      expect(owner.id).not.toBe(ids.admin);
      expect([...fake.venues.values()][0]!.ownerId).toBe(owner.id);
    });

    it('can create several venues for different owners', async () => {
      await create(body());
      const res = await create(
        body({
          owner: {
            name: 'Mehmet',
            email: 'mehmet@bar.example',
            password: PASSWORD,
          },
        }),
      );
      expect(res.status).toBe(201);
      expect(fake.venues.size).toBe(2);
    });

    it.each([
      [
        'a short password',
        {
          owner: { name: 'A', email: 'a@b.example', password: 'x'.repeat(11) },
        },
      ],
      [
        'a too long password',
        {
          owner: { name: 'A', email: 'a@b.example', password: 'x'.repeat(257) },
        },
      ],
      [
        'a bad e-mail',
        { owner: { name: 'A', email: 'nope', password: PASSWORD } },
      ],
      ['an empty venue name', { venue: { name: '  ' } }],
      [
        'a too long description',
        { venue: { name: 'X', description: 'x'.repeat(1001) } },
      ],
      ['a missing branch', { branch: undefined }],
    ])('rejects %s with 400 and creates nothing', async (_label, override) => {
      const res = await create(body(override));

      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).not.toContain(PASSWORD);
      expect(fake.users.size).toBe(Object.keys(ids).length);
      expect(fake.venues.size).toBe(0);
    });

    it('does not echo the submitted password in a validation error', async () => {
      const res = await create(
        body({ owner: { name: '', email: 'bad', password: 'short-secret' } }),
      );
      expect(res.status).toBe(400);
      expect(await res.text()).not.toContain('short-secret');
    });
  });

  describe('duplicate e-mail', () => {
    it('answers 409 EMAIL_ALREADY_EXISTS and leaves the existing account alone', async () => {
      const existing = fake.users.get(ids.influencer)!;
      const before = { ...existing };

      const res = await create(
        body({
          owner: {
            name: 'Biri',
            email: existing.email.toUpperCase(),
            password: PASSWORD,
          },
        }),
      );

      expect(res.status).toBe(409);
      expect(emailConflictErrorSchema.parse(await res.json()).code).toBe(
        'EMAIL_ALREADY_EXISTS',
      );
      // Not turned into an owner, not given a venue, password untouched.
      expect(fake.users.get(ids.influencer)).toEqual(before);
      expect(fake.venues.size).toBe(0);
      expect(fake.branches.size).toBe(0);
    });

    it('maps a unique violation raised by the database (a request that raced this one) to 409', async () => {
      // Another request created the account between this one's check and its insert.
      const original = fake.prisma.user.findUnique;
      fake.prisma.user.findUnique = (async (
        args: Parameters<typeof original>[0],
      ) =>
        'email' in args.where && args.where.email === 'ayse@kafe.example'
          ? null
          : original(args)) as typeof original;
      fake.users.set(
        '00000000-0000-4000-8000-0000000000e1',
        makeUser({
          id: '00000000-0000-4000-8000-0000000000e1',
          email: 'ayse@kafe.example',
        }),
      );

      const res = await create(body());

      expect(res.status).toBe(409);
      expect(fake.venues.size).toBe(0);
    });
  });

  describe('transaction', () => {
    it('leaves no user, venue or branch behind when a later step fails', async () => {
      fake.failures.venueCreate = new Error('database exploded');
      const usersBefore = fake.users.size;

      const res = await create(body());

      expect(res.status).toBe(500);
      expect(fake.users.size).toBe(usersBefore); // the owner row was rolled back
      expect(fake.venues.size).toBe(0);
      expect(fake.branches.size).toBe(0);
      expect(await res.text()).not.toContain(PASSWORD);
    });
  });

  describe('access control (both admin endpoints)', () => {
    it.each(['influencer', 'staff', 'ownerA', 'suspendedAdmin'] as const)(
      'refuses %s',
      async (who) => {
        expect((await create(body(), who)).status).toBe(403);
        expect((await list('', who)).status).toBe(403);
        expect(fake.venues.size).toBe(0);
      },
    );

    it('refuses anonymous callers and bad tokens', async () => {
      expect((await create(body(), null)).status).toBe(401);
      expect((await list('', null)).status).toBe(401);
      expect((await call('GET', '/admin/venues', 'not.a.jwt')).status).toBe(
        401,
      );
    });

    it('uses the current role: a demoted admin loses access at once', async () => {
      expect((await list()).status).toBe(200);
      fake.users.set(ids.admin, {
        ...fake.users.get(ids.admin)!,
        role: 'INFLUENCER',
      });
      expect((await list()).status).toBe(403);
      expect((await create(body())).status).toBe(403);
    });
  });

  describe('GET /admin/venues', () => {
    async function seed(count: number) {
      for (let i = 1; i <= count; i++) {
        const res = await create(
          body({
            owner: {
              name: `Sahip ${i}`,
              email: `sahip${i}@kafe.example`,
              password: PASSWORD,
            },
            venue: { name: `Mekan ${i}` },
          }),
        );
        expect(res.status).toBe(201);
      }
    }

    it('is empty at the start', async () => {
      const res = await list();
      expect(adminVenueListSchema.parse(await res.json())).toEqual({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it('pages through the venues, newest first, without repeats or gaps', async () => {
      await seed(5);

      const first = adminVenueListSchema.parse(
        await (await list('?page=1&pageSize=2')).json(),
      );
      const second = adminVenueListSchema.parse(
        await (await list('?page=2&pageSize=2')).json(),
      );
      const third = adminVenueListSchema.parse(
        await (await list('?page=3&pageSize=2')).json(),
      );

      expect(first).toMatchObject({
        page: 1,
        pageSize: 2,
        total: 5,
        totalPages: 3,
      });
      expect(first.items.map((v) => v.name)).toEqual(['Mekan 5', 'Mekan 4']);
      expect(second.items.map((v) => v.name)).toEqual(['Mekan 3', 'Mekan 2']);
      expect(third.items.map((v) => v.name)).toEqual(['Mekan 1']);
      const again = adminVenueListSchema.parse(
        await (await list('?page=1&pageSize=2')).json(),
      );
      expect(again.items.map((v) => v.id)).toEqual(
        first.items.map((v) => v.id),
      );
    });

    it('returns an empty page past the end', async () => {
      await seed(2);
      const res = await list('?page=9&pageSize=5');
      expect(adminVenueListSchema.parse(await res.json())).toMatchObject({
        items: [],
        total: 2,
        totalPages: 1,
      });
    });

    it.each([
      '?pageSize=51',
      '?pageSize=0',
      '?page=0',
      '?page=-3',
      '?page=x',
      '?pageSize=1000',
    ])('rejects %s (page size is capped at 50)', async (query) => {
      expect((await list(query)).status).toBe(400);
    });

    it('accepts the maximum page size', async () => {
      expect((await list('?pageSize=50')).status).toBe(200);
    });

    it('shows owner and branch basics and never a password or hash', async () => {
      await seed(1);
      const text = await (await list()).text();
      expect(text).toContain('sahip1@kafe.example');
      expect(text).not.toMatch(/argon2|passwordHash|"role"/);
      expect(text).not.toContain(PASSWORD);
    });
  });

  describe('GET /venues/mine', () => {
    async function createFor(ownerKey: 'ownerA' | 'ownerB', venueName: string) {
      // Attach a venue to an existing owner directly: this task has no endpoint for it.
      const owner = fake.users.get(ids[ownerKey])!;
      await fake.prisma.venue.create({
        data: {
          name: venueName,
          description: null,
          ownerId: owner.id,
          branches: {
            create: {
              name: `${venueName} şubesi`,
              city: 'İstanbul',
              address: 'Adres',
            },
          },
        },
        include: { owner: true, branches: {} },
      });
    }

    it('returns only the caller’s own venues and branches', async () => {
      await createFor('ownerA', 'A Kafe');
      await createFor('ownerA', 'A Bar');
      await createFor('ownerB', 'B Restoran');

      const a = myVenuesResponseSchema.parse(
        await (await mine('ownerA')).json(),
      );
      const b = myVenuesResponseSchema.parse(
        await (await mine('ownerB')).json(),
      );

      expect(a.items.map((v) => v.name)).toEqual(['A Kafe', 'A Bar']);
      expect(a.items.every((v) => v.branches.length === 1)).toBe(true);
      expect(b.items.map((v) => v.name)).toEqual(['B Restoran']);
      expect(JSON.stringify(a)).not.toContain('B Restoran');
      expect(JSON.stringify(b)).not.toMatch(/A Kafe|A Bar/);
    });

    it('is empty for an owner without venues', async () => {
      expect(
        myVenuesResponseSchema.parse(await (await mine('ownerA')).json()),
      ).toEqual({ items: [] });
    });

    it('ignores an ownerId (or any filter) sent by the client', async () => {
      await createFor('ownerB', 'B Restoran');
      const res = await mine(
        'ownerA',
        `?ownerId=${ids.ownerB}&owner=${ids.ownerB}`,
      );
      expect(myVenuesResponseSchema.parse(await res.json())).toEqual({
        items: [],
      });
    });

    it('does not expose the owner block, ids of users or any password data', async () => {
      await createFor('ownerA', 'A Kafe');
      const text = await (await mine('ownerA')).text();
      expect(text).not.toMatch(/ownerId|passwordHash|argon2|email/);
    });

    it('is VENUE_OWNER only: ADMIN, INFLUENCER, VENUE_STAFF and anonymous are refused', async () => {
      await createFor('ownerA', 'A Kafe');
      expect((await mine('admin')).status).toBe(403);
      expect((await mine('influencer')).status).toBe(403);
      expect((await mine('staff')).status).toBe(403);
      expect((await mine(null)).status).toBe(401);
    });
  });

  it('a created owner can immediately use /venues/mine with their own account', async () => {
    const res = await create(body());
    const created = adminVenueSchema.parse(await res.json());
    const { accessToken } = await createSessionWithToken(
      fake,
      jwt,
      created.owner.id,
    );

    const own = myVenuesResponseSchema.parse(
      await (await call('GET', '/venues/mine', accessToken)).json(),
    );

    expect(own.items.map((v) => v.id)).toEqual([created.id]);
  });
});
