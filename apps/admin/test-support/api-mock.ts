import { vi } from 'vitest';
import type * as api from '@/lib/api';

// The mocks live on globalThis so that every module instance (tests reload the
// modules to imitate Next.js bundling the proxy and the actions separately)
// talks to the same ones.
const KEY = Symbol.for('gossip-society.admin.test.api-mocks');

function create() {
  return {
    apiRefresh: vi.fn<typeof api.apiRefresh>(),
    apiLogout: vi.fn<typeof api.apiLogout>(),
    apiMe: vi.fn<typeof api.apiMe>(),
    apiLogin: vi.fn<typeof api.apiLogin>(),
    apiHealth: vi.fn<typeof api.apiHealth>(),
    apiListVenues: vi.fn<typeof api.apiListVenues>(),
    apiCreateVenue: vi.fn<typeof api.apiCreateVenue>(),
  };
}

export const apiMocks = ((globalThis as Record<symbol, unknown>)[KEY] ??=
  create()) as ReturnType<typeof create>;
