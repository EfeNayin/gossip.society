import type { MyVenuesResponse } from '@gossip/shared';
import type { FakeApi } from '@/session/test-support';
import type { ApiResult } from '@/session/types';
import type { VenuesApi } from './venues-api';

export const venue = (
  n: number,
  branches = 1,
  overrides: Partial<MyVenuesResponse['items'][number]> = {},
): MyVenuesResponse['items'][number] => ({
  id: `00000000-0000-4000-8000-0000000a${String(n).padStart(4, '0')}`,
  name: `Mekan ${n}`,
  description: n % 2 ? `Açıklama ${n}` : null,
  createdAt: '2026-10-10T12:00:00.000Z',
  branches: Array.from({ length: branches }, (_, i) => ({
    id: `00000000-0000-4000-8000-0000000b${String(n * 10 + i).padStart(4, '0')}`,
    name: `Şube ${n}.${i + 1}`,
    city: 'İstanbul',
    address: `Adres ${n}.${i + 1}`,
  })),
  ...overrides,
});

/**
 * Fake GET /venues/mine: answers from the user the access token belongs to
 * (the API's view), like the real endpoint. The answer is computed when the
 * request is handled; `hold()` only delays its delivery.
 */
export class FakeVenuesApi implements VenuesApi {
  byEmail = new Map<string, MyVenuesResponse['items']>();
  calls = 0;
  forced?: ApiResult<MyVenuesResponse>;
  tokensSeen: string[] = [];
  private gate?: Promise<void>;
  private open?: () => void;

  constructor(private readonly server: FakeApi) {}

  hold() {
    this.gate = new Promise<void>((resolve) => (this.open = resolve));
  }
  release() {
    this.open?.();
    this.gate = undefined;
  }

  async myVenues(accessToken: string): Promise<ApiResult<MyVenuesResponse>> {
    this.calls++;
    this.tokensSeen.push(accessToken);
    if (this.forced) return this.forced;
    const owner = this.server.userForAccessToken(accessToken);
    const result: ApiResult<MyVenuesResponse> = !owner
      ? { kind: 'error', status: 401 }
      : owner.role !== 'VENUE_OWNER'
        ? { kind: 'error', status: 403 }
        : { kind: 'ok', data: { items: this.byEmail.get(owner.email) ?? [] } };
    await this.gate;
    return result;
  }
}
