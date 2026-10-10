import type { DiscoverOffer, DiscoverOfferList } from '@gossip/shared';
import type { FakeApi } from '@/session/test-support';
import type { ApiResult } from '@/session/types';
import type { DiscoverApi } from './discover-api';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const discoverOffer = (
  n: number,
  overrides: Partial<DiscoverOffer> = {},
): DiscoverOffer => ({
  id: uuid(n),
  title: `İlan ${n}`,
  description: 'İki kişilik akşam yemeği daveti',
  serviceDescription: 'İki kişilik tadım menüsü',
  serviceValueKurus: 250_050,
  expectedContent: 'Bir reels ve üç story',
  minFollowers: 5000,
  capacity: 4,
  validFrom: '2026-10-01T06:00:00.000Z',
  validUntil: '2026-12-01T06:00:00.000Z',
  venue: { name: `Mekan ${n}` },
  branch: { name: 'Kadıköy', city: 'İstanbul', address: 'Bağdat Cad. 1' },
  ...overrides,
});

/**
 * Fake /discover/offers. It answers for the user an access token belongs to
 * (the API's view): only an INFLUENCER is served; an unknown token gets a 401
 * without running anything, like the real AuthGuard. `visible` is the API's
 * visibility rule: removing an id from it is "suspended or ended".
 */
export class FakeDiscoverApi implements DiscoverApi {
  offers = new Map<string, DiscoverOffer>();
  visible = new Set<string>();
  calls = { list: 0, get: 0 };
  forced: Partial<Record<keyof DiscoverApi, ApiResult<never>>> = {};
  private gate?: Promise<void>;
  private open?: () => void;

  constructor(private readonly server: FakeApi) {}

  add(offer: DiscoverOffer, visible = true) {
    this.offers.set(offer.id, offer);
    if (visible) this.visible.add(offer.id);
  }
  hold() {
    this.gate = new Promise<void>((resolve) => (this.open = resolve));
  }
  release() {
    this.open?.();
    this.gate = undefined;
  }
  private async answer<T>(result: ApiResult<T>): Promise<ApiResult<T>> {
    await this.gate; // the server already handled it; only delivery is delayed
    return result;
  }

  async list(
    token: string,
    page: number,
  ): Promise<ApiResult<DiscoverOfferList>> {
    this.calls.list++;
    const user = this.server.userForAccessToken(token);
    if (!user) return { kind: 'error', status: 401 };
    if (this.forced.list)
      return this.forced.list as ApiResult<DiscoverOfferList>;
    if (user.role !== 'INFLUENCER') return { kind: 'error', status: 403 };
    const shown = [...this.offers.values()].filter((o) =>
      this.visible.has(o.id),
    );
    const pageSize = 10;
    return this.answer({
      kind: 'ok',
      data: {
        items: shown.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: shown.length,
        totalPages: Math.ceil(shown.length / pageSize),
      },
    });
  }

  async get(token: string, id: string): Promise<ApiResult<DiscoverOffer>> {
    this.calls.get++;
    const user = this.server.userForAccessToken(token);
    if (!user) return { kind: 'error', status: 401 };
    if (this.forced.get) return this.forced.get as ApiResult<DiscoverOffer>;
    if (user.role !== 'INFLUENCER') return { kind: 'error', status: 403 };
    const found = this.offers.get(id);
    return this.answer(
      found && this.visible.has(id)
        ? { kind: 'ok', data: structuredClone(found) }
        : { kind: 'error', status: 404 },
    );
  }
}
