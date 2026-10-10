import type {
  CreateOfferRequest,
  OfferErrorCode,
  OwnerOffer,
  OwnerOfferList,
  UpdateOfferRequest,
} from '@gossip/shared';
import type { FakeApi } from '@/session/test-support';
import type { ApiResult } from '@/session/types';
import type { OffersApi } from './offers-api';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/**
 * Fake /offers/mine. It answers for the user an access token belongs to (the
 * API's view), enforces the draft-only edit and the owner's own branches, and
 * can be told to refuse a publish with a business-rule code. An unknown token
 * gets a 401 WITHOUT running anything, like the real AuthGuard.
 */
export class FakeOffersApi implements OffersApi {
  offers = new Map<string, { ownerEmail: string; offer: OwnerOffer }>();
  // branch id -> owner e-mail
  branches = new Map<
    string,
    { ownerEmail: string; name: string; venueName: string }
  >();
  calls = { list: 0, get: 0, create: 0, update: 0, publish: 0 };
  // The write calls that actually ran on the "server".
  executed = { create: 0, update: 0, publish: 0 };
  publishRefusal?: OfferErrorCode;
  forced: Partial<Record<keyof OffersApi, ApiResult<never>>> = {};
  private counter = 0;
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

  addBranch(
    id: string,
    ownerEmail: string,
    name = 'Merkez',
    venueName = 'Mekan',
  ) {
    this.branches.set(id, { ownerEmail, name, venueName });
  }

  private owner(token: string) {
    return this.server.userForAccessToken(token);
  }
  private async answer<T>(result: ApiResult<T>): Promise<ApiResult<T>> {
    await this.gate; // the server already handled it; only delivery is delayed
    return result;
  }
  private unauthorized<T>(): ApiResult<T> {
    return { kind: 'error', status: 401 };
  }

  async list(token: string, page: number): Promise<ApiResult<OwnerOfferList>> {
    this.calls.list++;
    if (this.forced.list) return this.forced.list as ApiResult<OwnerOfferList>;
    const user = this.owner(token);
    if (!user) return this.unauthorized();
    if (user.role !== 'VENUE_OWNER') return { kind: 'error', status: 403 };
    const mine = [...this.offers.values()]
      .filter((o) => o.ownerEmail === user.email)
      .map((o) => o.offer)
      .reverse();
    const pageSize = 10;
    return this.answer({
      kind: 'ok',
      data: {
        items: mine.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: mine.length,
        totalPages: Math.ceil(mine.length / pageSize),
      },
    });
  }

  async get(token: string, id: string): Promise<ApiResult<OwnerOffer>> {
    this.calls.get++;
    if (this.forced.get) return this.forced.get as ApiResult<OwnerOffer>;
    const user = this.owner(token);
    if (!user) return this.unauthorized();
    const found = this.offers.get(id);
    const result: ApiResult<OwnerOffer> =
      found && found.ownerEmail === user.email
        ? { kind: 'ok', data: structuredClone(found.offer) }
        : { kind: 'error', status: 404 };
    return this.answer(result);
  }

  async create(
    token: string,
    body: CreateOfferRequest,
  ): Promise<ApiResult<OwnerOffer>> {
    this.calls.create++;
    const user = this.owner(token);
    if (!user) return this.unauthorized(); // not executed
    if (this.forced.create) return this.forced.create as ApiResult<OwnerOffer>;
    const branch = this.branches.get(body.branchId);
    if (!branch || branch.ownerEmail !== user.email)
      return { kind: 'error', status: 404 };
    this.executed.create++;
    const { branchId, ...fields } = body;
    const offer: OwnerOffer = {
      id: uuid(++this.counter),
      ...fields,
      branch: { id: branchId, name: branch.name, city: 'İstanbul' },
      venue: { id: uuid(9000), name: branch.venueName },
      status: 'DRAFT',
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      suspension: null,
    };
    this.offers.set(offer.id, { ownerEmail: user.email, offer });
    return this.answer({ kind: 'ok', data: structuredClone(offer) });
  }

  async update(
    token: string,
    id: string,
    body: UpdateOfferRequest,
  ): Promise<ApiResult<OwnerOffer>> {
    this.calls.update++;
    const user = this.owner(token);
    if (!user) return this.unauthorized();
    if (this.forced.update) return this.forced.update as ApiResult<OwnerOffer>;
    const found = this.offers.get(id);
    if (!found || found.ownerEmail !== user.email)
      return { kind: 'error', status: 404 };
    if (found.offer.status !== 'DRAFT')
      return { kind: 'error', status: 409, offerCode: 'OFFER_NOT_DRAFT' };
    this.executed.update++;
    Object.assign(found.offer, body, { updatedAt: new Date().toISOString() });
    return this.answer({ kind: 'ok', data: structuredClone(found.offer) });
  }

  async publish(token: string, id: string): Promise<ApiResult<OwnerOffer>> {
    this.calls.publish++;
    const user = this.owner(token);
    if (!user) return this.unauthorized();
    if (this.forced.publish)
      return this.forced.publish as ApiResult<OwnerOffer>;
    const found = this.offers.get(id);
    if (!found || found.ownerEmail !== user.email)
      return { kind: 'error', status: 404 };
    if (found.offer.status === 'PUBLISHED')
      return this.answer({ kind: 'ok', data: structuredClone(found.offer) });
    if (found.offer.status !== 'DRAFT')
      return { kind: 'error', status: 409, offerCode: 'OFFER_NOT_DRAFT' };
    if (this.publishRefusal)
      return { kind: 'error', status: 409, offerCode: this.publishRefusal };
    this.executed.publish++;
    found.offer.status = 'PUBLISHED';
    found.offer.publishedAt = new Date().toISOString();
    return this.answer({ kind: 'ok', data: structuredClone(found.offer) });
  }
}

export const offerRequest = (
  branchId: string,
  overrides: Partial<CreateOfferRequest> = {},
): CreateOfferRequest => ({
  branchId,
  title: 'Akşam yemeği',
  description: 'd',
  serviceDescription: 's',
  serviceValueKurus: 250_000,
  expectedContent: 'e',
  minFollowers: 0,
  capacity: 2,
  validFrom: '2026-11-01T06:00:00.000Z',
  validUntil: '2026-12-01T06:00:00.000Z',
  ...overrides,
});
