import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      // Test-only value, not a real secret.
      JWT_SECRET: 'test-only-jwt-secret-0123456789abcdef-test-only',
      // Generous so unrelated tests sharing 127.0.0.1 never hit the limit;
      // the rate-limit spec overrides the throttler options explicitly.
      LOGIN_RATE_LIMIT: '1000',
    },
  },
});
