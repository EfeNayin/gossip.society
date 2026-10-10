import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  loginResponseSchema,
  offerErrorSchema,
  ownerOfferSchema,
  type CreateOfferRequest,
} from '@gossip/shared';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IDEMPOTENCY_RETENTION_MS, requestHash } from './offers.service.js';

// Idempotency-Key on POST /offers/mine against the real database: the unique
// index, the shared transaction of offer and key, concurrent requests and the
// lost-answer retry. Everything created is tied to e-mails starting with
// `itest-idem-<run>` (plus one temporary trigger whose name has the run id) and
// removed afterwards. Seed accounts are never touched.
const RUN = randomUUID().slice(0, 8);
const PREFIX = `itest-idem-${RUN}-`;
const PASSWORD = 'integration-test-password';
// Backdates a key row so it has expired (the CHECK needs createdAt < expiresAt).
const expired = {
  createdAt: new Date(Date.now() - 2 * IDEMPOTENCY_RETENTION_MS),
  expiresAt: new Date(Date.now() - 1000),
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const key = (name: string) => `itest-${RUN}-${name}-0123456789`;
const FAIL_PREFIX = `itest-fail-${RUN}-`;
const TRIGGER = `itest_idem_fail_${RUN}`;

const body = (
  branchId: string,
  overrides: Record<string, unknown> = {},
): CreateOfferRequest => ({
  branchId,
  title: 'Akşam yemeği',
  description: 'İki kişilik akşam yemeği daveti',
  serviceDescription: 'İki kişilik tadım menüsü',
  serviceValueKurus: 250_000,
  expectedContent: 'Bir reels videosu ve üç story',
  minFollowers: 5000,
  capacity: 4,
  // Fixed: a body built twice must be the same request.
  validFrom: '2030-01-01T00:00:00.000Z',
  validUntil: '2030-02-01T00:00:00.000Z',
  ...overrides,
});

// The columns of an Offer row for a request body (dates as Date).
const rowData = ({ validFrom, validUntil, ...rest }: CreateOfferRequest) => ({
  ...rest,
  validFrom: new Date(validFrom),
  validUntil: new Date(validUntil),
});

describe('Idempotency-Key on POST /offers/mine (PostgreSQL)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let port: number;
  let prisma: PrismaService;
  const tokens = new Map<string, string>();
  const userIds = new Map<string, string>();
  const email = (name: string) =>
    `${PREFIX}${name.toLowerCase()}@gossip-society.example`;

  const send = (who: string, idemKey: string | undefined, payload: unknown) =>
    fetch(`${baseUrl}/offers/mine`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${tokens.get(who)}`,
        ...(idemKey === undefined ? {} : { 'idempotency-key': idemKey }),
      },
      body: JSON.stringify(payload),
    });
  const request = (
    method: string,
    path: string,
    who: string,
    payload?: unknown,
  ) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(payload === undefined
          ? {}
          : { 'content-type': 'application/json' }),
        authorization: `Bearer ${tokens.get(who)}`,
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });

  async function makeOwner(name: string) {
    const user = await prisma.user.create({
      data: {
        email: email(name),
        name: `Test ${name}`,
        role: 'VENUE_OWNER',
        status: 'ACTIVE',
        passwordHash: await hash(PASSWORD),
      },
    });
    userIds.set(name, user.id);
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email(name), password: PASSWORD }),
    });
    tokens.set(name, loginResponseSchema.parse(await res.json()).accessToken);
  }

  // Each test gets its own venue/branch, so counts never mix.
  async function makeBranch(ownerName: string, label: string) {
    const venue = await prisma.venue.create({
      data: {
        name: `${PREFIX}${label}`,
        ownerId: userIds.get(ownerName)!,
        branches: {
          create: { name: 'Merkez', city: 'İstanbul', address: 'Adres' },
        },
      },
      include: { branches: true },
    });
    return venue.branches[0]!.id;
  }

  const offersIn = (branchId: string) =>
    prisma.offer.count({ where: { branchId } });
  const keyRows = (userName: string, idemKey?: string) =>
    prisma.idempotencyKey.findMany({
      where: {
        userId: userIds.get(userName)!,
        ...(idemKey ? { key: idemKey } : {}),
      },
    });
  const errorCode = async (res: Response) =>
    offerErrorSchema.parse(await res.json()).code;

  // A transaction the TEST holds open: it has inserted an offer and a key row
  // (uncommitted), like a request that is in the middle of its transaction.
  async function holdWinner(
    ownerName: string,
    branchId: string,
    idemKey: string,
    winnerBody: CreateOfferRequest,
  ) {
    let decide!: (commit: boolean) => void;
    const decision = new Promise<boolean>((resolve) => (decide = resolve));
    let inserted!: (offerId: string) => void;
    const insertedPromise = new Promise<string>(
      (resolve) => (inserted = resolve),
    );
    const finished = prisma.$transaction(
      async (tx) => {
        const offer = await tx.offer.create({ data: rowData(winnerBody) });
        await tx.idempotencyKey.create({
          data: {
            userId: userIds.get(ownerName)!,
            operation: 'offer.create',
            key: idemKey,
            requestHash: requestHash(winnerBody),
            offerId: offer.id,
            expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS),
          },
        });
        inserted(offer.id);
        if (!(await decision)) throw new Error('rolled back on purpose');
      },
      { timeout: 25_000, maxWait: 10_000 },
    );
    const offerId = await insertedPromise;
    return {
      offerId,
      commit: async () => {
        decide(true);
        await finished;
      },
      rollback: async () => {
        decide(false);
        await finished.catch(() => undefined);
      },
    };
  }

  // Waits until PostgreSQL reports a backend blocked on a lock while inserting
  // into IdempotencyKey: the request has reached the unique index.
  async function waitUntilBlockedOnKey(): Promise<void> {
    for (let i = 0; i < 200; i++) {
      const rows = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
          AND query ILIKE 'INSERT INTO%IdempotencyKey%'`;
      if (rows[0]!.n > 0) return;
      await sleep(25);
    }
    throw new Error('the request never blocked on the idempotency key');
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    port = (app.getHttpServer().address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
    prisma = moduleRef.get(PrismaService);
    await makeOwner('ownerA');
    await makeOwner('ownerB');
    // Test-only fault injection: saving a key whose text starts with
    // FAIL_PREFIX fails inside PostgreSQL, after the offer was inserted.
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION ${TRIGGER}() RETURNS trigger AS $$
      BEGIN
        IF NEW."key" LIKE '${FAIL_PREFIX}%' THEN
          RAISE EXCEPTION 'itest forced failure';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER ${TRIGGER} BEFORE INSERT ON "IdempotencyKey" FOR EACH ROW EXECUTE FUNCTION ${TRIGGER}()`,
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS ${TRIGGER} ON "IdempotencyKey"`,
    );
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${TRIGGER}()`);
    const owners = { owner: { email: { startsWith: PREFIX } } };
    // Deleting the offers removes their key rows (ON DELETE CASCADE).
    await prisma.offer.deleteMany({ where: { branch: { venue: owners } } });
    await prisma.venue.deleteMany({ where: owners });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await app.close();
  });

  it('same key and body again: the same offer, one row each, marked as a replay', async () => {
    const branch = await makeBranch('ownerA', 'replay');
    const k = key('replay');
    const first = await send('ownerA', k, body(branch));
    const second = await send('ownerA', k, body(branch));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.headers.get('idempotent-replayed')).toBeNull();
    expect(second.headers.get('idempotent-replayed')).toBe('true');
    const a = ownerOfferSchema.parse(await first.json());
    const b = ownerOfferSchema.parse(await second.json());
    expect(b.id).toBe(a.id);
    expect(await offersIn(branch)).toBe(1);
    const rows = await keyRows('ownerA', k);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ offerId: a.id, operation: 'offer.create' });
    expect(rows[0]!.requestHash).toMatch(/^[0-9a-f]{64}$/);
    // Retention is 24 h from the create (createdAt is the database's clock).
    const kept = rows[0]!.expiresAt.getTime() - rows[0]!.createdAt.getTime();
    expect(Math.abs(kept - IDEMPOTENCY_RETENTION_MS)).toBeLessThan(5000);
  });

  it('same key, different content: 409 IDEMPOTENCY_KEY_REUSED and nothing new is stored', async () => {
    const branch = await makeBranch('ownerA', 'differs');
    const other = await makeBranch('ownerA', 'differs-other');
    const k = key('differs');
    expect((await send('ownerA', k, body(branch))).status).toBe(201);

    for (const changed of [
      body(branch, { title: 'Başka başlık' }),
      body(branch, { serviceValueKurus: 250_001 }),
      body(other), // another (own) branch
    ]) {
      const res = await send('ownerA', k, changed);
      expect(res.status).toBe(409);
      expect(await errorCode(res)).toBe('IDEMPOTENCY_KEY_REUSED');
    }
    expect(await offersIn(branch)).toBe(1);
    expect(await offersIn(other)).toBe(0);
    expect(await keyRows('ownerA', k)).toHaveLength(1);
  });

  it('eight concurrent requests with one key leave exactly one offer', async () => {
    const branch = await makeBranch('ownerA', 'race');
    const k = key('race');
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => send('ownerA', k, body(branch))),
    );

    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(201));
    const ids = await Promise.all(
      responses.map(async (r) => ownerOfferSchema.parse(await r.json()).id),
    );
    expect(new Set(ids).size).toBe(1);
    const replays = responses.filter(
      (r) => r.headers.get('idempotent-replayed') === 'true',
    );
    expect(replays).toHaveLength(7); // exactly one request created it
    expect(await offersIn(branch)).toBe(1);
    expect(await keyRows('ownerA', k)).toHaveLength(1);
  });

  it('concurrent requests that share a key but differ in content: one wins, the rest are 409, one offer', async () => {
    const branch = await makeBranch('ownerA', 'race-mixed');
    const k = key('race-mixed');
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_v, i) =>
        send('ownerA', k, body(branch, { title: `Başlık ${i % 2}` })),
      ),
    );
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201).length).toBeGreaterThanOrEqual(1);
    expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);
    expect(await offersIn(branch)).toBe(1);
    const stored = await prisma.offer.findFirstOrThrow({
      where: { branchId: branch },
    });
    // Every 201 carries the stored offer; every 409 is the other content.
    for (const res of responses.filter((r) => r.status === 201)) {
      expect(ownerOfferSchema.parse(await res.json()).title).toBe(stored.title);
    }
  });

  describe('controlled order: the test holds the winner’s open transaction', () => {
    it('a request that reaches the unique index while the winner is uncommitted waits, then replays the winner (its own offer is rolled back)', async () => {
      const branch = await makeBranch('ownerA', 'held-commit');
      const k = key('held-commit');
      const winner = await holdWinner('ownerA', branch, k, body(branch));

      const pending = send('ownerA', k, body(branch));
      await waitUntilBlockedOnKey();
      // The loser's own offer exists only inside its open transaction.
      expect(await offersIn(branch)).toBe(0);
      await winner.commit();
      const res = await pending;

      expect(res.status).toBe(201);
      expect(res.headers.get('idempotent-replayed')).toBe('true');
      expect(ownerOfferSchema.parse(await res.json()).id).toBe(winner.offerId);
      expect(await offersIn(branch)).toBe(1);
      expect(await keyRows('ownerA', k)).toHaveLength(1);
    });

    it('when the winner rolls back instead, the waiting request creates the offer itself', async () => {
      const branch = await makeBranch('ownerA', 'held-rollback');
      const k = key('held-rollback');
      const winner = await holdWinner('ownerA', branch, k, body(branch));

      const pending = send('ownerA', k, body(branch));
      await waitUntilBlockedOnKey();
      await winner.rollback();
      const res = await pending;

      expect(res.status).toBe(201);
      expect(res.headers.get('idempotent-replayed')).toBeNull();
      expect(ownerOfferSchema.parse(await res.json()).id).not.toBe(
        winner.offerId,
      );
      expect(await offersIn(branch)).toBe(1);
      expect(await keyRows('ownerA', k)).toHaveLength(1);
    });

    it('a waiting request with different content gets 409 once the winner commits, and stores nothing', async () => {
      const branch = await makeBranch('ownerA', 'held-conflict');
      const k = key('held-conflict');
      const winner = await holdWinner('ownerA', branch, k, body(branch));

      const pending = send(
        'ownerA',
        k,
        body(branch, { title: 'Başka içerik' }),
      );
      await waitUntilBlockedOnKey();
      await winner.commit();
      const res = await pending;

      expect(res.status).toBe(409);
      expect(await errorCode(res)).toBe('IDEMPOTENCY_KEY_REUSED');
      expect(await offersIn(branch)).toBe(1);
    });
  });

  it('a lost answer: the client hangs up right after sending, retries with the same key, and ends up with one offer', async () => {
    const branch = await makeBranch('ownerA', 'lost-answer');
    const k = key('lost-answer');
    const payload = JSON.stringify(body(branch));

    // The server receives and runs the request; the client destroys the socket
    // before reading any answer.
    await new Promise<void>((resolve) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path: '/offers/mine',
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload),
            authorization: `Bearer ${tokens.get('ownerA')}`,
            'idempotency-key': k,
            connection: 'close',
          },
        },
        () => undefined,
      );
      req.on('error', () => undefined);
      req.write(payload, () => {
        req.destroy();
        resolve();
      });
    });
    // The create finished on the server although nobody read the answer.
    for (let i = 0; i < 200 && (await offersIn(branch)) === 0; i++) {
      await sleep(25);
    }
    expect(await offersIn(branch)).toBe(1);

    const retry = await send('ownerA', k, body(branch));
    expect(retry.status).toBe(201);
    expect(retry.headers.get('idempotent-replayed')).toBe('true');
    const stored = await prisma.offer.findFirstOrThrow({
      where: { branchId: branch },
    });
    expect(ownerOfferSchema.parse(await retry.json()).id).toBe(stored.id);
    expect(await offersIn(branch)).toBe(1);

    // Contrast: the same retry WITHOUT a key makes a second offer.
    await send('ownerA', undefined, body(branch));
    await send('ownerA', undefined, body(branch));
    expect(await offersIn(branch)).toBe(3);
  });

  describe('users are isolated', () => {
    it('the same key for two owners is two independent requests', async () => {
      const branchA = await makeBranch('ownerA', 'iso-a');
      const branchB = await makeBranch('ownerB', 'iso-b');
      const k = key('iso-same');
      const a = await send('ownerA', k, body(branchA));
      const b = await send('ownerB', k, body(branchB));

      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(b.headers.get('idempotent-replayed')).toBeNull();
      expect(ownerOfferSchema.parse(await a.json()).id).not.toBe(
        ownerOfferSchema.parse(await b.json()).id,
      );
      expect(await keyRows('ownerA', k)).toHaveLength(1);
      expect(await keyRows('ownerB', k)).toHaveLength(1);
    });

    it('another owner who sends the first owner’s key and body gets 404, never the first owner’s offer', async () => {
      const branchA = await makeBranch('ownerA', 'iso-leak');
      const k = key('iso-leak');
      const a = ownerOfferSchema.parse(
        await (await send('ownerA', k, body(branchA))).json(),
      );

      const res = await send('ownerB', k, body(branchA));
      expect(res.status).toBe(404);
      expect(JSON.stringify(await res.json())).not.toContain(a.id);
      expect(await keyRows('ownerB', k)).toHaveLength(0);
      expect(await offersIn(branchA)).toBe(1);
    });
  });

  describe('offer and key commit or roll back together', () => {
    it('a branch that is not the caller’s: 404, no offer, no key; the key stays usable', async () => {
      const mine = await makeBranch('ownerA', 'rb-mine');
      const theirs = await makeBranch('ownerB', 'rb-theirs');
      const k = key('rb-branch');

      expect((await send('ownerA', k, body(theirs))).status).toBe(404);
      expect(await offersIn(theirs)).toBe(0);
      expect(await keyRows('ownerA', k)).toHaveLength(0);
      expect((await send('ownerA', k, body(mine))).status).toBe(201);
    });

    it('saving the key fails inside PostgreSQL after the offer insert: 500 and the offer is gone', async () => {
      const branch = await makeBranch('ownerA', 'rb-fail');
      const k = `${FAIL_PREFIX}0123456789`;

      const res = await send('ownerA', k, body(branch));
      expect(res.status).toBe(500);
      expect(await offersIn(branch)).toBe(0);
      expect(await keyRows('ownerA', k)).toHaveLength(0);
    });
  });

  describe('retention and cleanup', () => {
    it('an expired key is forgotten: the same key and body then create a new offer, and the old key row is replaced', async () => {
      const branch = await makeBranch('ownerA', 'expired');
      const k = key('expired');
      const first = ownerOfferSchema.parse(
        await (await send('ownerA', k, body(branch))).json(),
      );
      await prisma.idempotencyKey.updateMany({
        where: { key: k },
        data: expired,
      });

      const again = await send('ownerA', k, body(branch));
      expect(again.status).toBe(201);
      expect(again.headers.get('idempotent-replayed')).toBeNull();
      expect(ownerOfferSchema.parse(await again.json()).id).not.toBe(first.id);
      expect(await offersIn(branch)).toBe(2);
      const rows = await keyRows('ownerA', k);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('later keyed creates delete expired keys (of anyone), keep live ones and keep the offers', async () => {
      const branchA = await makeBranch('ownerA', 'purge-a');
      const branchB = await makeBranch('ownerB', 'purge-b');
      const liveKey = key('purge-live');
      await send('ownerB', liveKey, body(branchB));
      const oldKeys = [key('purge-old1'), key('purge-old2')];
      for (const k of oldKeys)
        await send('ownerB', k, body(branchB, { title: k }));
      await prisma.idempotencyKey.updateMany({
        where: { key: { in: oldKeys } },
        data: expired,
      });

      await send('ownerA', key('purge-trigger'), body(branchA));

      expect(await keyRows('ownerB', oldKeys[0])).toHaveLength(0);
      expect(await keyRows('ownerB', oldKeys[1])).toHaveLength(0);
      expect(await keyRows('ownerB', liveKey)).toHaveLength(1);
      expect(await offersIn(branchB)).toBe(3); // offers are not deleted with their keys
    });

    it('does not use process memory: nothing but the table decides (a row inserted directly is honoured)', async () => {
      const branch = await makeBranch('ownerA', 'table-only');
      const k = key('table-only');
      const offer = await prisma.offer.create({
        data: {
          ...rowData(body(branch)),
        },
      });
      await prisma.idempotencyKey.create({
        data: {
          userId: userIds.get('ownerA')!,
          operation: 'offer.create',
          key: k,
          requestHash: requestHash(body(branch)),
          offerId: offer.id,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      const res = await send('ownerA', k, body(branch));
      expect(res.headers.get('idempotent-replayed')).toBe('true');
      expect(ownerOfferSchema.parse(await res.json()).id).toBe(offer.id);
      expect(await offersIn(branch)).toBe(1);
    });
  });

  it('rejects a malformed key with 400 and stores nothing', async () => {
    const branch = await makeBranch('ownerA', 'bad-key');
    for (const bad of [
      'short',
      'has spaces in the key 123456',
      'a'.repeat(129),
    ]) {
      expect((await send('ownerA', bad, body(branch))).status).toBe(400);
    }
    expect(await offersIn(branch)).toBe(0);
  });

  it('the database itself refuses rows that break the rules (CHECK constraints) and cascades on delete', async () => {
    const branch = await makeBranch('ownerA', 'checks');
    const offer = await prisma.offer.create({
      data: {
        ...rowData(body(branch)),
      },
    });
    const good = {
      userId: userIds.get('ownerA')!,
      operation: 'offer.create',
      key: key('checks'),
      requestHash: 'a'.repeat(64),
      offerId: offer.id,
      expiresAt: new Date(Date.now() + 60_000),
    };
    await expect(
      prisma.idempotencyKey.create({ data: { ...good, key: 'short' } }),
    ).rejects.toThrow();
    await expect(
      prisma.idempotencyKey.create({ data: { ...good, requestHash: 'abc' } }),
    ).rejects.toThrow();
    await expect(
      prisma.idempotencyKey.create({ data: { ...good, operation: '' } }),
    ).rejects.toThrow();
    await expect(
      prisma.idempotencyKey.create({
        data: { ...good, expiresAt: new Date(Date.now() - 60_000) },
      }),
    ).rejects.toThrow();
    // Unique per (user, operation, key); another operation name is another scope.
    await prisma.idempotencyKey.create({ data: good });
    await expect(
      prisma.idempotencyKey.create({ data: good }),
    ).rejects.toThrow();
    await prisma.idempotencyKey.create({
      data: { ...good, operation: 'offer.other' },
    });

    await prisma.offer.delete({ where: { id: offer.id } });
    expect(await keyRows('ownerA', good.key)).toHaveLength(0);
  });

  it('refuses to edit another owner’s draft with a complete, valid body: 404 and nothing changes', async () => {
    const theirs = await makeBranch('ownerB', 'edit-theirs');
    const created = ownerOfferSchema.parse(
      await (await send('ownerB', key('edit-theirs'), body(theirs))).json(),
    );
    const { branchId: _b, ...fields } = body(theirs, {
      title: 'Ele geçirildi',
    });
    void _b;

    const res = await request(
      'PUT',
      `/offers/mine/${created.id}`,
      'ownerA',
      fields,
    );

    expect(res.status).toBe(404);
    expect(
      (await prisma.offer.findUniqueOrThrow({ where: { id: created.id } }))
        .title,
    ).toBe('Akşam yemeği');
    // The owner can edit it with the very same body.
    expect(
      (await request('PUT', `/offers/mine/${created.id}`, 'ownerB', fields))
        .status,
    ).toBe(200);
  });
});
