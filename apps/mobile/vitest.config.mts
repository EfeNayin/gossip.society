import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Only the React-Native-free session logic is unit tested here (src/session).
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
