import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiMocks } from '../../test-support/api-mock';
import { RedirectError, requestContext } from '../../test-support/next-mocks';
import { adminUser, venue } from '../../test-support/venue-fixtures';
import { cookieNames } from '@/lib/cookies';
import { createVenueAction, type CreateVenueState } from './venues';

vi.mock('@/lib/api', async (importOriginal) => {
  const { apiMocks } = await import('../../test-support/api-mock');
  return { ...(await importOriginal<object>()), ...apiMocks };
});

const { access: AT } = cookieNames(false);
const PASSWORD = '  secret initial passw0rd  ';
const SAME_ORIGIN = {
  host: 'localhost:3001',
  origin: 'http://localhost:3001',
  'sec-fetch-site': 'same-origin',
};

const forgeries: [string, Record<string, string>][] = [
  ['no Origin header', { host: 'localhost:3001' }],
  [
    'cross-site Origin',
    {
      host: 'localhost:3001',
      origin: 'https://evil.example',
      'sec-fetch-site': 'cross-site',
    },
  ],
  [
    'an Origin of another host',
    { host: 'localhost:3001', origin: 'https://evil.example' },
  ],
  [
    'cross-site fetch metadata',
    { ...SAME_ORIGIN, 'sec-fetch-site': 'cross-site' },
  ],
];

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const fields = {
    ownerName: 'Ayşe Yılmaz',
    ownerEmail: ' Ayse@Kafe.EXAMPLE ',
    ownerPassword: PASSWORD,
    venueName: 'Örnek Kafe',
    venueDescription: 'Açıklama',
    branchName: 'Kadıköy',
    branchCity: 'İstanbul',
    branchAddress: 'Örnek Sokak No: 1',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function run(data: FormData) {
  try {
    return {
      state: (await createVenueAction(
        { status: 'idle' },
        data,
      )) as CreateVenueState,
    };
  } catch (error) {
    if (error instanceof RedirectError) return { redirect: error.url };
    throw error;
  }
}

// An admin whose session the API confirms.
function asAdmin() {
  requestContext.headers = new Headers(SAME_ORIGIN);
  requestContext.cookies.set(AT, 'access-token');
  apiMocks.apiMe.mockResolvedValue({ kind: 'ok', data: adminUser });
}

describe('createVenueAction', () => {
  beforeEach(() => {
    for (const mock of Object.values(apiMocks)) mock.mockReset();
  });

  describe('CSRF', () => {
    it.each(forgeries)('does nothing for %s', async (_label, headers) => {
      asAdmin();
      requestContext.headers = new Headers(headers);

      const { state } = await run(form());

      expect(state).toMatchObject({ status: 'error' });
      expect(apiMocks.apiCreateVenue).not.toHaveBeenCalled();
      expect(apiMocks.apiMe).not.toHaveBeenCalled();
      expect(JSON.stringify(state)).not.toContain('secret initial');
    });
  });

  describe('authorization on the server', () => {
    it.each([
      ['no session cookie', () => requestContext.cookies.clear()],
      [
        'a revoked session',
        () => apiMocks.apiMe.mockResolvedValue({ kind: 'error', status: 401 }),
      ],
      [
        'a suspended account',
        () =>
          apiMocks.apiMe.mockResolvedValue({
            kind: 'error',
            status: 403,
            code: 'ACCOUNT_SUSPENDED',
          }),
      ],
      [
        'a venue owner',
        () =>
          apiMocks.apiMe.mockResolvedValue({
            kind: 'ok',
            data: { ...adminUser, role: 'VENUE_OWNER' },
          }),
      ],
      [
        'an influencer',
        () =>
          apiMocks.apiMe.mockResolvedValue({
            kind: 'ok',
            data: { ...adminUser, role: 'INFLUENCER' },
          }),
      ],
    ])(
      'sends %s to the end-session step without calling the API',
      async (_label, arrange) => {
        asAdmin();
        arrange();

        const result = await run(form());

        expect(result.redirect).toBe('/session/end');
        expect(apiMocks.apiCreateVenue).not.toHaveBeenCalled();
      },
    );

    it('says so when the API cannot be reached, without creating anything', async () => {
      asAdmin();
      apiMocks.apiMe.mockResolvedValue({ kind: 'unreachable' });

      const { state } = await run(form());

      expect(state).toMatchObject({ status: 'error' });
      expect(apiMocks.apiCreateVenue).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('returns field errors and values, calls nothing, and never returns the password', async () => {
      asAdmin();

      const { state } = await run(
        form({ ownerEmail: 'nope', ownerPassword: 'short', venueName: '' }),
      );

      expect(state).toMatchObject({
        status: 'error',
        fieldErrors: {
          ownerEmail: expect.any(String),
          ownerPassword: expect.any(String),
          venueName: expect.any(String),
        },
        values: { ownerName: 'Ayşe Yılmaz', branchCity: 'İstanbul' },
      });
      expect(apiMocks.apiCreateVenue).not.toHaveBeenCalled();
      expect(JSON.stringify(state)).not.toContain('short');
      expect(Object.keys((state as { values: object }).values)).not.toContain(
        'ownerPassword',
      );
    });
  });

  describe('creating', () => {
    it('sends the normalized request once and goes back to the list; the password is not in the URL', async () => {
      asAdmin();
      apiMocks.apiCreateVenue.mockResolvedValue({ kind: 'ok', data: venue(1) });

      const result = await run(form());

      expect(result.redirect).toBe('/venues?created=1');
      expect(result.redirect).not.toContain('secret');
      expect(apiMocks.apiCreateVenue).toHaveBeenCalledTimes(1);
      expect(apiMocks.apiCreateVenue).toHaveBeenCalledWith('access-token', {
        owner: {
          name: 'Ayşe Yılmaz',
          email: 'ayse@kafe.example',
          password: PASSWORD,
        },
        venue: { name: 'Örnek Kafe', description: 'Açıklama' },
        branch: {
          name: 'Kadıköy',
          city: 'İstanbul',
          address: 'Örnek Sokak No: 1',
        },
      });
    });

    it('shows a taken e-mail on the e-mail field and keeps the other values (not the password)', async () => {
      asAdmin();
      apiMocks.apiCreateVenue.mockResolvedValue({
        kind: 'error',
        status: 409,
        venueCode: 'EMAIL_ALREADY_EXISTS',
      });

      const { state } = await run(form());

      expect(state).toMatchObject({
        status: 'error',
        fieldErrors: {
          ownerEmail: 'Bu e-posta adresiyle kayıtlı bir hesap zaten var.',
        },
        values: { venueName: 'Örnek Kafe' },
      });
      expect(JSON.stringify(state)).not.toContain('secret initial');
    });

    it('does not retry and tells the admin to check the list when the answer is lost', async () => {
      asAdmin();
      apiMocks.apiCreateVenue.mockResolvedValue({ kind: 'unreachable' });

      const { state } = await run(form());

      expect(state).toMatchObject({
        status: 'unknown',
        message: expect.stringContaining('listesini kontrol edin'),
      });
      expect(apiMocks.apiCreateVenue).toHaveBeenCalledTimes(1); // never automatically repeated
      expect(JSON.stringify(state)).not.toContain('secret initial');
    });

    it.each([500, 502, 503])(
      'treats a %i as "check the list" too',
      async (status) => {
        asAdmin();
        apiMocks.apiCreateVenue.mockResolvedValue({ kind: 'error', status });

        const { state } = await run(form());

        expect(state).toMatchObject({ status: 'unknown' });
        expect(apiMocks.apiCreateVenue).toHaveBeenCalledTimes(1);
      },
    );

    it.each([401, 403])(
      'sends the visitor to the end-session step when the API answers %i',
      async (status) => {
        asAdmin();
        apiMocks.apiCreateVenue.mockResolvedValue({ kind: 'error', status });
        expect((await run(form())).redirect).toBe('/session/end');
      },
    );

    it('reports a rejected request without echoing anything', async () => {
      asAdmin();
      apiMocks.apiCreateVenue.mockResolvedValue({ kind: 'error', status: 400 });
      const { state } = await run(form());
      expect(state).toMatchObject({
        status: 'error',
        message: expect.any(String),
      });
      expect(JSON.stringify(state)).not.toContain('secret initial');
    });
  });
});
