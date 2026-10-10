import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiCreateVenue,
  apiListVenues,
  apiLogin,
  apiLogout,
  apiMe,
  apiRefresh,
} from './api';

const user = {
  id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a11',
  email: 'admin@gossip-society.example',
  name: 'Dev Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
};
const tokens = {
  accessToken: 'access',
  accessTokenExpiresAt: '2026-10-10T12:15:00.000Z',
  refreshToken: 'refresh',
  refreshTokenExpiresAt: '2026-10-17T12:00:00.000Z',
};

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('api client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    process.env.API_URL = 'http://api.test';
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('logs in against API_URL without caching and parses the shared contract', async () => {
    fetchMock.mockResolvedValue(
      json(200, { ...tokens, user: { ...user, passwordHash: 'x' } }),
    );

    const result = await apiLogin({ email: user.email, password: 'pw' });

    expect(result).toEqual({ kind: 'ok', data: { ...tokens, user } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.test/auth/login');
    expect(init?.cache).toBe('no-store');
    expect(init?.method).toBe('POST');
  });

  it('sends the access token as a Bearer header only where one is given', async () => {
    fetchMock.mockResolvedValue(json(200, user));
    await apiMe('tok');
    expect(
      new Headers(fetchMock.mock.calls[0]![1]?.headers).get('authorization'),
    ).toBe('Bearer tok');

    fetchMock.mockResolvedValue(json(200, { ...tokens, user }));
    await apiLogin({ email: user.email, password: 'pw' });
    expect(
      new Headers(fetchMock.mock.calls[1]![1]?.headers).get('authorization'),
    ).toBeNull();
  });

  it('surfaces the account status code of a 403', async () => {
    fetchMock.mockResolvedValue(
      json(403, { statusCode: 403, code: 'ACCOUNT_SUSPENDED', message: 'x' }),
    );
    expect(await apiLogin({ email: user.email, password: 'pw' })).toEqual({
      kind: 'error',
      status: 403,
      code: 'ACCOUNT_SUSPENDED',
    });
  });

  it.each([401, 429, 500])('reports status %i', async (status) => {
    fetchMock.mockResolvedValue(json(status, { message: 'x' }));
    expect(await apiLogin({ email: user.email, password: 'pw' })).toEqual({
      kind: 'error',
      status,
      code: undefined,
    });
  });

  it('reports an unreachable API', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect(await apiMe('tok')).toEqual({ kind: 'unreachable' });
  });

  it('does not trust a 200 that breaks the contract', async () => {
    fetchMock.mockResolvedValue(json(200, { accessToken: 'only' }));
    expect(await apiLogin({ email: user.email, password: 'pw' })).toEqual({
      kind: 'error',
      status: 502,
    });
  });

  it('accepts the empty 204 of logout', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await apiLogout('tok')).toEqual({ kind: 'ok', data: undefined });
  });

  describe('apiRefresh', () => {
    it('returns the new token pair', async () => {
      fetchMock.mockResolvedValue(json(200, { ...tokens, user }));
      expect(await apiRefresh('old')).toEqual({ kind: 'ok', tokens });
      expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({
        refreshToken: 'old',
      });
    });

    it.each([401, 403])(
      'treats %i as the end of the session',
      async (status) => {
        fetchMock.mockResolvedValue(json(status, {}));
        expect(await apiRefresh('old')).toEqual({ kind: 'rejected' });
      },
    );

    it.each([429, 500, 503])(
      'keeps the session on a temporary %i',
      async (status) => {
        fetchMock.mockResolvedValue(json(status, {}));
        expect(await apiRefresh('old')).toEqual({ kind: 'unavailable' });
      },
    );

    it('keeps the session when the API is unreachable', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));
      expect(await apiRefresh('old')).toEqual({ kind: 'unavailable' });
    });
  });

  describe('venues', () => {
    const venue = {
      id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a21',
      name: 'Örnek Kafe',
      description: null,
      createdAt: '2026-10-10T12:00:00.000Z',
      owner: {
        id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a22',
        name: 'Ayşe',
        email: 'ayse@kafe.example',
        status: 'ACTIVE',
        passwordHash: '$argon2id$should-never-matter',
      },
      branches: [
        {
          id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a23',
          name: 'K',
          city: 'C',
          address: 'A',
        },
      ],
    };
    const request = {
      owner: {
        name: 'Ayşe',
        email: 'ayse@kafe.example',
        password: 'initial-password-1',
      },
      venue: { name: 'Örnek Kafe' },
      branch: { name: 'K', city: 'C', address: 'A' },
    };

    it('lists with the page in the query and the admin token', async () => {
      fetchMock.mockResolvedValue(
        json(200, {
          items: [venue],
          page: 2,
          pageSize: 10,
          total: 11,
          totalPages: 2,
        }),
      );

      const result = await apiListVenues('tok', { page: 2, pageSize: 10 });

      expect(fetchMock.mock.calls[0]![0]).toBe(
        'http://api.test/admin/venues?page=2&pageSize=10',
      );
      expect(
        new Headers(fetchMock.mock.calls[0]![1]?.headers).get('authorization'),
      ).toBe('Bearer tok');
      expect(fetchMock.mock.calls[0]![1]?.cache).toBe('no-store');
      expect(result.kind).toBe('ok');
      // Whatever the API sends beyond the contract is dropped.
      expect(JSON.stringify(result)).not.toContain('argon2');
    });

    it('creates with a POST body that carries the password, once, uncached', async () => {
      fetchMock.mockResolvedValue(json(201, venue));

      const result = await apiCreateVenue('tok', request);

      expect(result.kind).toBe('ok');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('http://api.test/admin/venues');
      expect(init?.method).toBe('POST');
      expect(init?.cache).toBe('no-store');
      expect(JSON.parse(String(init?.body))).toEqual(request);
      expect(JSON.stringify(result)).not.toContain('initial-password-1');
      expect(JSON.stringify(result)).not.toContain('argon2');
    });

    it('surfaces the 409 e-mail conflict code', async () => {
      fetchMock.mockResolvedValue(
        json(409, {
          statusCode: 409,
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'x',
        }),
      );
      expect(await apiCreateVenue('tok', request)).toEqual({
        kind: 'error',
        status: 409,
        code: undefined,
        venueCode: 'EMAIL_ALREADY_EXISTS',
      });
    });

    it('does not retry on a network error', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));
      expect(await apiCreateVenue('tok', request)).toEqual({
        kind: 'unreachable',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
