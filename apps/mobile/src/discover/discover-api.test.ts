import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDiscoverApi, DISCOVER_PAGE_SIZE } from './discover-api';
import { discoverOffer } from './test-support';

const offer = discoverOffer(1);
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('createDiscoverApi', () => {
  const fetchMock = vi.fn();
  const api = createDiscoverApi(
    'http://api.test/',
    fetchMock as unknown as typeof fetch,
  );
  const lastCall = () => {
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    return {
      url: String(url),
      init: init as RequestInit,
      headers: new Headers((init as RequestInit).headers),
    };
  };
  beforeEach(() => {
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads a page with GET, a bearer token and the page size, naming no user', async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        items: [],
        page: 2,
        pageSize: DISCOVER_PAGE_SIZE,
        total: 0,
        totalPages: 0,
      }),
    );
    expect((await api.list('tok', 2)).kind).toBe('ok');
    const call = lastCall();
    expect(call.url).toBe(
      `http://api.test/discover/offers?page=2&pageSize=${DISCOVER_PAGE_SIZE}`,
    );
    expect(call.init.method).toBe('GET');
    expect(call.headers.get('authorization')).toBe('Bearer tok');
    expect(call.url).not.toMatch(/user|owner|status/i);
    expect(call.init.body).toBeUndefined();
  });

  it('reads one offer by id', async () => {
    fetchMock.mockResolvedValue(json(200, offer));
    const result = await api.get('tok', offer.id);
    expect(result).toEqual({ kind: 'ok', data: offer });
    expect(lastCall().url).toBe(`http://api.test/discover/offers/${offer.id}`);
  });

  it('encodes the id so it cannot change the path', async () => {
    fetchMock.mockResolvedValue(json(404, {}));
    await api.get('tok', '../offers/mine');
    expect(lastCall().url).toBe(
      'http://api.test/discover/offers/..%2Foffers%2Fmine',
    );
  });

  it('keeps the status of an error (404 hidden, 403 role, 401)', async () => {
    for (const status of [404, 403, 401]) {
      fetchMock.mockResolvedValue(json(status, { statusCode: status }));
      expect(await api.get('tok', offer.id)).toMatchObject({
        kind: 'error',
        status,
      });
    }
  });

  it('an answer that breaks the shared contract is a controlled error, not data', async () => {
    fetchMock.mockResolvedValue(
      json(200, { ...offer, serviceValueKurus: 19.99 }),
    );
    expect(await api.get('tok', offer.id)).toMatchObject({
      kind: 'error',
      status: 502,
    });
    fetchMock.mockResolvedValue(json(200, { items: [{ id: 'x' }], page: 1 }));
    expect(await api.list('tok', 1)).toMatchObject({
      kind: 'error',
      status: 502,
    });
  });

  it('a network failure is "unreachable"', async () => {
    fetchMock.mockRejectedValue(new TypeError('network'));
    expect(await api.list('tok', 1)).toEqual({ kind: 'unreachable' });
  });
});
