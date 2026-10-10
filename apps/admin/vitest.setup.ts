import { beforeEach, vi } from 'vitest';
import { requestContext } from './test-support/next-mocks';

vi.mock('next/headers', async () => {
  const mocks = await import('./test-support/next-mocks');
  return {
    cookies: async () => mocks.cookieStore(),
    headers: async () => mocks.headersStore(),
  };
});

vi.mock('next/navigation', async () => {
  const mocks = await import('./test-support/next-mocks');
  return {
    redirect: (url: string) => {
      throw new mocks.RedirectError(url);
    },
  };
});

beforeEach(() => {
  requestContext.reset();
  // The coordinator lives on globalThis; start every test with a fresh one.
  delete (globalThis as Record<symbol, unknown>)[
    Symbol.for('gossip-society.admin.refresh-coordinator')
  ];
});
