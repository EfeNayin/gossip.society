import { parseEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'x'.repeat(32),
};

describe('parseEnv', () => {
  it('applies defaults for the non-secret auth settings', () => {
    const env = parseEnv(base);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.LOGIN_RATE_LIMIT).toBe(10);
    expect(env.LOGIN_RATE_WINDOW_SECONDS).toBe(60);
  });

  it('fails clearly when JWT_SECRET is missing', () => {
    expect(() => parseEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('fails clearly when JWT_SECRET is empty or too short', () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
    expect(() => parseEnv({ ...base, JWT_SECRET: 'short' })).toThrow(
      /at least 32/,
    );
  });

  it('defaults the session to 7 days and refresh limits', () => {
    const env = parseEnv(base);
    expect(env.SESSION_TTL_SECONDS).toBe(604800);
    expect(env.REFRESH_RATE_LIMIT).toBe(20);
    expect(env.REFRESH_RATE_WINDOW_SECONDS).toBe(60);
  });

  it('rejects a session shorter than the access token', () => {
    expect(() =>
      parseEnv({
        ...base,
        JWT_ACCESS_TTL_SECONDS: '900',
        SESSION_TTL_SECONDS: '60',
      }),
    ).toThrow(/SESSION_TTL_SECONDS/);
  });

  it('rejects a non-positive token lifetime', () => {
    expect(() => parseEnv({ ...base, JWT_ACCESS_TTL_SECONDS: '0' })).toThrow(
      /JWT_ACCESS_TTL_SECONDS/,
    );
  });
});
