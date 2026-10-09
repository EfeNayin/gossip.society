import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    },
  },
});
