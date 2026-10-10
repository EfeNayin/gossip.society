import { describe, expect, it } from 'vitest';
import type { SafeUser } from '@gossip/shared';
import { classifyMe } from './session-state';

const user = (overrides: Partial<SafeUser> = {}): SafeUser => ({
  id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a11',
  email: 'admin@gossip-society.example',
  name: 'Dev Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
  ...overrides,
});

describe('classifyMe', () => {
  it('opens the panel only for an ACTIVE ADMIN', () => {
    expect(classifyMe({ kind: 'ok', data: user() })).toEqual({
      kind: 'ok',
      user: user(),
    });
  });

  it.each(['VENUE_OWNER', 'VENUE_STAFF', 'INFLUENCER'] as const)(
    'refuses an active %s',
    (role) => {
      expect(classifyMe({ kind: 'ok', data: user({ role }) })).toEqual({
        kind: 'forbidden',
      });
    },
  );

  it.each(['PENDING', 'SUSPENDED'] as const)('refuses a %s admin', (status) => {
    expect(classifyMe({ kind: 'ok', data: user({ status }) })).toEqual({
      kind: 'inactive',
    });
  });

  it('maps 401 to unauthenticated and an account-status 403 to inactive', () => {
    expect(classifyMe({ kind: 'error', status: 401 })).toEqual({
      kind: 'unauthenticated',
    });
    expect(
      classifyMe({ kind: 'error', status: 403, code: 'ACCOUNT_SUSPENDED' }),
    ).toEqual({
      kind: 'inactive',
    });
  });

  it('does not end the session when the API is down or failing', () => {
    expect(classifyMe({ kind: 'unreachable' })).toEqual({
      kind: 'unavailable',
    });
    expect(classifyMe({ kind: 'error', status: 500 })).toEqual({
      kind: 'unavailable',
    });
    expect(classifyMe({ kind: 'error', status: 429 })).toEqual({
      kind: 'unavailable',
    });
    expect(classifyMe({ kind: 'error', status: 403 })).toEqual({
      kind: 'unavailable',
    });
  });
});
