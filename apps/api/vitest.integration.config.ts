import { defineConfig } from 'vitest/config';

// Tests that need a real PostgreSQL (DATABASE_URL from apps/api/.env, migrations
// applied). Run with `pnpm --filter api test:integration`; not part of `pnpm test`.
// They create their own users and delete only those afterwards.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.integration.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      // Test-only value, not a real secret.
      JWT_SECRET: 'test-only-jwt-secret-0123456789abcdef-test-only',
      LOGIN_RATE_LIMIT: '100000',
      REFRESH_RATE_LIMIT: '100000',
    },
  },
});
