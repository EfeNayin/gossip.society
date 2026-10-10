import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOffersApi } from './offers-api';
import { offerRequest } from './test-support';

const BRANCH = '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a11';
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const offer = {
  id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a21',
  branch: { id: BRANCH, name: 'Kadıköy', city: 'İstanbul' },
  venue: { id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a22', name: 'Kafe' },
  title: 'T',
  description: 'd',
  serviceDescription: 's',
  serviceValueKurus: 1999,
  expectedContent: 'e',
  minFollowers: 0,
  capacity: 1,
  validFrom: '2026-11-01T06:00:00.000Z',
  validUntil: '2026-12-01T06:00:00.000Z',
  status: 'DRAFT',
  publishedAt: null,
  createdAt: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-10T10:00:00.000Z',
  suspension: null,
};

describe('createOffersApi', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const api = createOffersApi(
    'http://api.test/',
    fetchMock as unknown as typeof fetch,
  );
  beforeEach(() => {
    fetchMock.mockReset();
  });
  const lastCall = () => {
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    return {
      url: String(url),
      init: init as RequestInit,
      headers: new Headers(init?.headers),
    };
  };

  it('lists with the page in the query and only the Bearer token as identity', async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        items: [offer],
        page: 2,
        pageSize: 10,
        total: 11,
        totalPages: 2,
      }),
    );
    expect((await api.list('tok', 2)).kind).toBe('ok');
    const call = lastCall();
    expect(call.url).toBe('http://api.test/offers/mine?page=2&pageSize=10');
    expect(call.init.method).toBe('GET');
    expect(call.headers.get('authorization')).toBe('Bearer tok');
    expect(call.url).not.toMatch(/owner|user/i);
  });

  it('reads one offer', async () => {
    fetchMock.mockResolvedValue(json(200, offer));
    expect((await api.get('tok', offer.id)).kind).toBe('ok');
    expect(lastCall().url).toBe(`http://api.test/offers/mine/${offer.id}`);
  });

  it('creates with POST and the request body (kuruş integer, UTC dates)', async () => {
    fetchMock.mockResolvedValue(json(201, offer));
    await api.create('tok', offerRequest(BRANCH));
    const call = lastCall();
    expect(call.url).toBe('http://api.test/offers/mine');
    expect(call.init.method).toBe('POST');
    const body = JSON.parse(String(call.init.body));
    expect(body).toMatchObject({
      branchId: BRANCH,
      serviceValueKurus: 250_000,
      validFrom: '2026-11-01T06:00:00.000Z',
    });
    expect(Number.isInteger(body.serviceValueKurus)).toBe(true);
    expect(Object.keys(body)).not.toContain('status');
  });

  it('edits with PUT to the offer', async () => {
    fetchMock.mockResolvedValue(json(200, offer));
    const { branchId: _b, ...fields } = offerRequest(BRANCH);
    void _b;
    await api.update('tok', offer.id, fields);
    const call = lastCall();
    expect(call.url).toBe(`http://api.test/offers/mine/${offer.id}`);
    expect(call.init.method).toBe('PUT');
  });

  it('publishes with a POST that has no body', async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        ...offer,
        status: 'PUBLISHED',
        publishedAt: '2026-10-10T10:00:00.000Z',
      }),
    );
    await api.publish('tok', offer.id);
    const call = lastCall();
    expect(call.url).toBe(`http://api.test/offers/mine/${offer.id}/publish`);
    expect(call.init.method).toBe('POST');
    expect(call.init.body).toBeUndefined();
  });

  it.each([
    'NO_ACTIVE_SUBSCRIPTION',
    'QUOTA_EXCEEDED',
    'OFFER_NOT_DRAFT',
    'OFFER_EXPIRED',
  ] as const)('surfaces the 409 code %s', async (code) => {
    fetchMock.mockResolvedValue(
      json(409, { statusCode: 409, code, message: 'x' }),
    );
    expect(await api.publish('tok', offer.id)).toMatchObject({
      kind: 'error',
      status: 409,
      offerCode: code,
    });
  });

  it('turns an answer that breaks the shared schema into a controlled error', async () => {
    for (const bad of [
      { ...offer, status: 'ACTIVE' },
      { ...offer, serviceValueKurus: 19.99 },
      { items: [] },
      null,
    ]) {
      fetchMock.mockResolvedValue(json(200, bad));
      expect(await api.get('tok', offer.id)).toEqual({
        kind: 'error',
        status: 502,
      });
    }
  });

  it('reports 404 and an unreachable API', async () => {
    fetchMock.mockResolvedValue(json(404, { message: 'x' }));
    expect(await api.get('tok', offer.id)).toMatchObject({
      kind: 'error',
      status: 404,
    });
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    expect(await api.get('tok', offer.id)).toEqual({ kind: 'unreachable' });
  });
});
