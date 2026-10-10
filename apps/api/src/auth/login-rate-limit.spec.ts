import { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';

const PASSWORD = 'correct horse battery staple';
const LIMIT = 3;

describe('login rate limit', () => {
  let app: INestApplication;
  let baseUrl: string;

  const login = (password: string) =>
    fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'rate@gossip-society.example', password }),
    });

  beforeEach(async () => {
    // The limit is read from the environment when the modules load, so reload
    // them with a small limit; this also proves the env setting is wired up.
    vi.stubEnv('LOGIN_RATE_LIMIT', String(LIMIT));
    vi.resetModules();
    const { createFakePrisma, createTestApp, makeUser } =
      await import('./auth-test-utils.js');

    const fake = createFakePrisma();
    const user = makeUser({
      id: '00000000-0000-4000-8000-0000000000b1',
      email: 'rate@gossip-society.example',
      passwordHash: await hash(PASSWORD),
    });
    fake.users.set(user.id, user);
    const created = await createTestApp(fake.prisma);
    app = created.app;
    baseUrl = created.baseUrl;
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('answers 429 once the attempts per window are used up, even with the right password', async () => {
    for (let attempt = 0; attempt < LIMIT; attempt++) {
      expect((await login('wrong')).status).toBe(401);
    }
    const blocked = await login(PASSWORD);
    expect(blocked.status).toBe(429);
    expect(JSON.stringify(await blocked.json())).toContain('Çok fazla deneme');
    expect((await login('wrong')).status).toBe(429);
  });

  it('does not limit other routes', async () => {
    for (let attempt = 0; attempt < LIMIT + 2; attempt++) {
      expect((await fetch(`${baseUrl}/health`)).status).toBe(200);
    }
  });
});
