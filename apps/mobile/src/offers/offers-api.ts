import {
  IDEMPOTENCY_KEY_HEADER,
  ownerOfferListSchema,
  ownerOfferSchema,
  type CreateOfferRequest,
  type OwnerOffer,
  type OwnerOfferList,
  type UpdateOfferRequest,
} from '@gossip/shared';
import { createCaller } from '@/session/api';
import type { ApiResult } from '@/session/types';

export const OFFERS_PAGE_SIZE = 10;

export interface OffersApi {
  list(accessToken: string, page: number): Promise<ApiResult<OwnerOfferList>>;
  get(accessToken: string, id: string): Promise<ApiResult<OwnerOffer>>;
  create(
    accessToken: string,
    body: CreateOfferRequest,
    idempotencyKey: string,
  ): Promise<ApiResult<OwnerOffer>>;
  update(
    accessToken: string,
    id: string,
    body: UpdateOfferRequest,
  ): Promise<ApiResult<OwnerOffer>>;
  publish(accessToken: string, id: string): Promise<ApiResult<OwnerOffer>>;
}

// The owner is the authenticated user: nothing here names a user or an owner,
// and a client can't send a status. Responses are checked with the shared schemas.
export function createOffersApi(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): OffersApi {
  const call = createCaller(baseUrl, fetchImpl);
  const parseOffer = (json: unknown) => ownerOfferSchema.parse(json);
  return {
    list: (accessToken, page) =>
      call(`/offers/mine?page=${page}&pageSize=${OFFERS_PAGE_SIZE}`, {
        token: accessToken,
        parse: (json) => ownerOfferListSchema.parse(json),
      }),
    get: (accessToken, id) =>
      call(`/offers/mine/${encodeURIComponent(id)}`, {
        token: accessToken,
        parse: parseOffer,
      }),
    // The key makes repeating this call safe: the API returns the same offer
    // for the same key and body instead of creating another.
    create: (accessToken, body, idempotencyKey) =>
      call('/offers/mine', {
        method: 'POST',
        token: accessToken,
        body,
        headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
        parse: parseOffer,
      }),
    update: (accessToken, id, body) =>
      call(`/offers/mine/${encodeURIComponent(id)}`, {
        method: 'PUT',
        token: accessToken,
        body,
        parse: parseOffer,
      }),
    publish: (accessToken, id) =>
      call(`/offers/mine/${encodeURIComponent(id)}/publish`, {
        method: 'POST',
        token: accessToken,
        parse: parseOffer,
      }),
  };
}
