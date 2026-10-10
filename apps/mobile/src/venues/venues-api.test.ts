import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVenuesApi } from './venues-api';
import { venue } from './test-support';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('createVenuesApi', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const api = createVenuesApi(
    'http://api.test/',
    fetchMock as unknown as typeof fetch,
  );

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('asks GET /venues/mine with the Bearer token and nothing that names a user', async () => {
    fetchMock.mockResolvedValue(json(200, { items: [venue(1, 2)] }));

    const result = await api.myVenues('access-token');

    expect(result.kind).toBe('ok');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.test/venues/mine'); // no ?ownerId, no user id in the path
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer access-token',
    );
  });

  it('returns the venues with their branches', async () => {
    fetchMock.mockResolvedValue(
      json(200, { items: [venue(1, 2), venue(2, 1)] }),
    );
    const result = await api.myVenues('t');
    expect(
      result.kind === 'ok' && result.data.items.map((v) => v.branches.length),
    ).toEqual([2, 1]);
  });

  it('turns an answer that breaks the shared schema into a controlled error', async () => {
    for (const bad of [
      {
        items: [
          {
            id: 'not-a-guid',
            name: 'X',
            description: null,
            createdAt: '2026-10-10T12:00:00Z',
            branches: [],
          },
        ],
      },
      { items: 'nope' },
      { somethingElse: true },
      [],
      null,
    ]) {
      fetchMock.mockResolvedValue(json(200, bad));
      expect(await api.myVenues('t')).toEqual({ kind: 'error', status: 502 });
    }
  });

  it('does not accept an answer with a branch missing required fields', async () => {
    const broken = venue(1);
    // @ts-expect-error deliberately incomplete
    delete broken.branches[0].address;
    fetchMock.mockResolvedValue(json(200, { items: [broken] }));
    expect(await api.myVenues('t')).toEqual({ kind: 'error', status: 502 });
  });

  it.each([401, 403, 429, 500])('reports status %i', async (status) => {
    fetchMock.mockResolvedValue(json(status, { message: 'x' }));
    expect(await api.myVenues('t')).toMatchObject({ kind: 'error', status });
  });

  it('reports an unreachable API', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    expect(await api.myVenues('t')).toEqual({ kind: 'unreachable' });
  });
});
