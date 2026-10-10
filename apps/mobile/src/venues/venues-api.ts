import { myVenuesResponseSchema, type MyVenuesResponse } from '@gossip/shared';
import { createCaller } from '@/session/api';
import type { ApiResult } from '@/session/types';

export interface VenuesApi {
  /**
   * The signed-in owner's own venues and branches. The server decides whose
   * from the access token: no user id or owner id is sent.
   */
  myVenues(accessToken: string): Promise<ApiResult<MyVenuesResponse>>;
}

export function createVenuesApi(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): VenuesApi {
  const call = createCaller(baseUrl, fetchImpl);
  return {
    myVenues: (accessToken) =>
      call('/venues/mine', {
        token: accessToken,
        parse: (json) => myVenuesResponseSchema.parse(json),
      }),
  };
}
