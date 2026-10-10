import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiMocks } from '../test-support/api-mock';
import { requestContext } from '../test-support/next-mocks';
import { adminUser } from '../test-support/venue-fixtures';
import { cookieNames } from './cookies';
import { getAdminContext } from './admin-context';

vi.mock('@/lib/api', async (importOriginal) => {
  const { apiMocks } = await import('../test-support/api-mock');
  return { ...(await importOriginal<object>()), ...apiMocks };
});

const { access: AT } = cookieNames(false);

describe('getAdminContext', () => {
  beforeEach(() => {
    for (const mock of Object.values(apiMocks)) mock.mockReset();
  });

  it('gives an ACTIVE ADMIN the user and the token for the admin endpoints', async () => {
    requestContext.cookies.set(AT, 'tok');
    apiMocks.apiMe.mockResolvedValue({ kind: 'ok', data: adminUser });
    expect(await getAdminContext()).toEqual({
      kind: 'ok',
      user: adminUser,
      accessToken: 'tok',
    });
  });

  it.each([
    [
      'other roles',
      { kind: 'ok', data: { ...adminUser, role: 'VENUE_OWNER' } },
    ],
    ['a revoked session', { kind: 'error', status: 401 }],
    [
      'a suspended admin',
      { kind: 'error', status: 403, code: 'ACCOUNT_SUSPENDED' },
    ],
  ] as const)('ends the session for %s', async (_label, answer) => {
    requestContext.cookies.set(AT, 'tok');
    apiMocks.apiMe.mockResolvedValue(answer);
    expect(await getAdminContext()).toEqual({ kind: 'end' });
  });

  it('ends the session without a cookie, without asking the API', async () => {
    expect(await getAdminContext()).toEqual({ kind: 'end' });
    expect(apiMocks.apiMe).not.toHaveBeenCalled();
  });

  it('reports an unreachable API as unavailable (the session is kept)', async () => {
    requestContext.cookies.set(AT, 'tok');
    apiMocks.apiMe.mockResolvedValue({ kind: 'unreachable' });
    expect(await getAdminContext()).toEqual({ kind: 'unavailable' });
  });
});
