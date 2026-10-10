import {
  discoverOfferListSchema,
  discoverOfferSchema,
  type DiscoverOffer,
  type DiscoverOfferList,
} from '@gossip/shared';
import { createCaller } from '@/session/api';
import type { ApiResult } from '@/session/types';

export const DISCOVER_PAGE_SIZE = 10;

export interface DiscoverApi {
  list(
    accessToken: string,
    page: number,
  ): Promise<ApiResult<DiscoverOfferList>>;
  get(accessToken: string, id: string): Promise<ApiResult<DiscoverOffer>>;
}

// Read-only. Nothing here names a user: the influencer is the authenticated
// one. Responses are checked with the same shared schemas the API answers with.
export function createDiscoverApi(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): DiscoverApi {
  const call = createCaller(baseUrl, fetchImpl);
  return {
    list: (accessToken, page) =>
      call(`/discover/offers?page=${page}&pageSize=${DISCOVER_PAGE_SIZE}`, {
        token: accessToken,
        parse: (json) => discoverOfferListSchema.parse(json),
      }),
    get: (accessToken, id) =>
      call(`/discover/offers/${encodeURIComponent(id)}`, {
        token: accessToken,
        parse: (json) => discoverOfferSchema.parse(json),
      }),
  };
}
