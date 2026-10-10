import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash, verify } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import {
  adminVenueListSchema,
  adminVenueSchema,
  loginResponseSchema,
  myVenuesResponseSchema,
} from '@gossip/shared';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { VenuesService } from './venues.service.js';

// Runs against the real database. Every row it creates belongs to e-mails that
// start with `itest-venues-<run>-`, and only those are removed afterwards
// (venues and branches first). Seed accounts are never read or changed.
const RUN = randomUUID().slice(0, 8);
const PREFIX = `itest-venues-${RUN}-`;
const email = (name: string) => `${PREFIX}${name}@gossip-society.example`;
const PASSWORD = 'integration-initial-password';

describe('venue creation against PostgreSQL', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let venuesService: VenuesService;
  let adminToken: string;

  const request = (
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

  const body = (
    name: string,
    overrides: { email?: string; venueName?: string } = {},
  ) => ({
    owner: {
      name: `Sahip ${name}`,
      email: overrides.email ?? email(name),
      password: PASSWORD,
    },
    venue: {
      name: overrides.venueName ?? `Mekan ${name}`,
      description: `${name} açıklaması`,
    },
    branch: {
      name: 'Merkez',
      city: 'İstanbul',
      address: `${name} Sokak No: 1`,
    },
  });
  const create = (payload: unknown) =>
    request('POST', '/admin/venues', adminToken, payload);
  const counts = async (like: string | { startsWith: string }) => ({
    users: await prisma.user.count({ where: { email: like } }),
    venues: await prisma.venue.count({ where: { owner: { email: like } } }),
    branches: await prisma.venueBranch.count({
      where: { venue: { owner: { email: like } } },
    }),
  });

  async function login(address: string, password = PASSWORD) {
    const res = await request('POST', '/auth/login', undefined, {
      email: address,
      password,
    });
    return {
      status: res.status,
      body:
        res.status === 200
          ? loginResponseSchema.parse(await res.json())
          : undefined,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = moduleRef.get(PrismaService);
    venuesService = moduleRef.get(VenuesService);

    await prisma.user.create({
      data: {
        email: email('admin'),
        name: 'Integration Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
        passwordHash: await hash(PASSWORD),
      },
    });
    adminToken = (await login(email('admin'))).body!.accessToken;
  });

  afterAll(async () => {
    const owners = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    // Branches go with their venue; a venue's owner can't be deleted before it.
    await prisma.venue.deleteMany({
      where: { ownerId: { in: owners.map((o) => o.id) } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await app.close();
  });

  it('admin creates -> it is listed -> the new owner signs in with the existing login', async () => {
    const res = await create(body('ana'));
    expect(res.status).toBe(201);
    const venue = adminVenueSchema.parse(await res.json());

    // Stored as the spec says.
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: email('ana') },
    });
    expect(owner).toMatchObject({
      role: 'VENUE_OWNER',
      status: 'ACTIVE',
      name: 'Sahip ana',
    });
    expect(owner.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verify(owner.passwordHash!, PASSWORD)).toBe(true);
    expect(owner.passwordHash).not.toContain(PASSWORD);
    const stored = await prisma.venue.findUniqueOrThrow({
      where: { id: venue.id },
      include: { branches: true },
    });
    expect(stored.ownerId).toBe(owner.id);
    expect(stored.branches).toHaveLength(1);

    // Listed (find it through the paging).
    const seen: string[] = [];
    let page = 1;
    for (;;) {
      const listRes = await request(
        'GET',
        `/admin/venues?page=${page}&pageSize=5`,
        adminToken,
      );
      const data = adminVenueListSchema.parse(await listRes.json());
      seen.push(...data.items.map((v) => v.id));
      if (page >= data.totalPages) break;
      page++;
    }
    expect(seen).toContain(venue.id);

    // The new owner signs in with the normal login and reads their own venue.
    const owned = await login(email('ana'));
    expect(owned.status).toBe(200);
    expect(owned.body!.user).toMatchObject({
      role: 'VENUE_OWNER',
      status: 'ACTIVE',
    });
    const mine = myVenuesResponseSchema.parse(
      await (
        await request('GET', '/venues/mine', owned.body!.accessToken)
      ).json(),
    );
    expect(mine.items.map((v) => v.id)).toEqual([venue.id]);
    expect((await login(email('ana'), 'wrong-password-123')).status).toBe(401);
  });

  it('two owners only ever see their own venues', async () => {
    await create(body('bir'));
    await create(body('iki'));

    const one = (await login(email('bir'))).body!.accessToken;
    const two = (await login(email('iki'))).body!.accessToken;
    const mineOne = myVenuesResponseSchema.parse(
      await (await request('GET', '/venues/mine', one)).json(),
    );
    const mineTwo = myVenuesResponseSchema.parse(
      await (await request('GET', '/venues/mine', two)).json(),
    );

    expect(mineOne.items.map((v) => v.name)).toEqual(['Mekan bir']);
    expect(mineTwo.items.map((v) => v.name)).toEqual(['Mekan iki']);
    // Roles other than VENUE_OWNER are refused on the real stack too.
    expect((await request('GET', '/venues/mine', adminToken)).status).toBe(403);
  });

  it('answers 409 for a taken e-mail and creates nothing', async () => {
    await create(body('cakisma'));
    const before = await counts({ startsWith: PREFIX });
    const original = await prisma.user.findUniqueOrThrow({
      where: { email: email('cakisma') },
    });

    const res = await create(body('cakisma', { venueName: 'Başka Mekan' }));

    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe(
      'EMAIL_ALREADY_EXISTS',
    );
    expect(await counts({ startsWith: PREFIX })).toEqual(before);
    expect(
      await prisma.user.findUniqueOrThrow({
        where: { email: email('cakisma') },
      }),
    ).toEqual(original);
  });

  it('never converts or extends an existing non-owner account', async () => {
    const existing = await prisma.user.create({
      data: {
        email: email('mevcut'),
        name: 'Mevcut',
        role: 'INFLUENCER',
        status: 'PENDING',
        passwordHash: await hash('another-password-1'),
      },
    });

    const res = await create(body('mevcut'));

    expect(res.status).toBe(409);
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: existing.id },
    });
    expect(after).toEqual(existing); // role, status, hash, name: all unchanged
    expect(await prisma.venue.count({ where: { ownerId: existing.id } })).toBe(
      0,
    );
  });

  it('treats e-mails that differ only by case or spaces as the same account', async () => {
    expect(
      (
        await create(
          body('norm', { email: `  ${email('norm').toUpperCase()}  ` }),
        )
      ).status,
    ).toBe(201);
    expect(await prisma.user.count({ where: { email: email('norm') } })).toBe(
      1,
    );
    expect((await create(body('norm'))).status).toBe(409);
  });

  it('lets exactly one of many simultaneous requests for the same e-mail win', async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        create(body('yaris', { venueName: `Yarış Mekanı ${i}` })),
      ),
    );

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(7); // the database unique constraint, mapped
    expect(await counts(email('yaris'))).toEqual({
      users: 1,
      venues: 1,
      branches: 1,
    });
  });

  it('also holds when the simultaneous requests spell the e-mail differently', async () => {
    const spellings = [
      email('harf'),
      email('harf').toUpperCase(),
      ` ${email('harf')} `,
    ];
    const responses = await Promise.all(
      spellings.map((address) => create(body('harf', { email: address }))),
    );

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await counts(email('harf'))).toEqual({
      users: 1,
      venues: 1,
      branches: 1,
    });
  });

  it('rolls everything back when a later step fails (no user, venue or branch left)', async () => {
    const target = email('geri-al');
    // Postgres refuses a NUL character in text, so the venue insert fails AFTER
    // the owner row was inserted inside the same transaction. (The API schema
    // would not let this through; the service is called directly.)
    await expect(
      venuesService.create({
        owner: { name: 'Geri Al', email: target, password: PASSWORD },
        venue: { name: 'Bozuk Mekan', description: 'null bayt: \u0000' },
        branch: { name: 'Merkez', city: 'İstanbul', address: 'Adres' },
      }),
    ).rejects.toThrow();

    expect(await counts(target)).toEqual({ users: 0, venues: 0, branches: 0 });
    // The e-mail is still free: a correct request now succeeds.
    expect((await create(body('geri-al'))).status).toBe(201);
  });

  it('pages through the full list with stable order and no repeats or gaps', async () => {
    for (const name of ['s1', 's2', 's3']) await create(body(name));
    const total = await prisma.venue.count();

    const ids: string[] = [];
    for (let page = 1; ; page++) {
      const res = await request(
        'GET',
        `/admin/venues?page=${page}&pageSize=2`,
        adminToken,
      );
      const data = adminVenueListSchema.parse(await res.json());
      expect(data.total).toBe(total);
      expect(data.items.length).toBeLessThanOrEqual(2);
      ids.push(...data.items.map((v) => v.id));
      if (page >= data.totalPages) break;
    }

    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total); // no repeats
    // Newest first: the three just created appear in reverse creation order.
    const created = await prisma.venue.findMany({
      where: { owner: { email: { in: ['s1', 's2', 's3'].map(email) } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    expect(created.map((v) => ids.indexOf(v.id))).toEqual(
      [...created.map((v) => ids.indexOf(v.id))].sort((a, b) => a - b),
    );
  });

  it('refuses non-admins on the real stack', async () => {
    const owner = (await login(email('ana'))).body!.accessToken;
    expect(
      (await request('POST', '/admin/venues', owner, body('yetkisiz'))).status,
    ).toBe(403);
    expect((await request('GET', '/admin/venues', owner)).status).toBe(403);
    expect((await request('GET', '/admin/venues')).status).toBe(401);
    expect(await counts(email('yetkisiz'))).toEqual({
      users: 0,
      venues: 0,
      branches: 0,
    });
  });
});
