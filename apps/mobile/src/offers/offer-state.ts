import type { OwnerOffer } from '@gossip/shared';

// What the owner sees for an offer. It is derived from the status the API
// returns plus the dates; there is no extra status in the backend.
export type OfferDisplay = {
  key: 'draft' | 'published' | 'not-started' | 'expired' | 'suspended';
  label: string;
};

export function offerDisplay(
  offer: Pick<OwnerOffer, 'status' | 'validFrom' | 'validUntil'>,
  now: number = Date.now(),
): OfferDisplay {
  switch (offer.status) {
    case 'DRAFT':
      return { key: 'draft', label: 'Taslak' };
    case 'SUSPENDED':
      return { key: 'suspended', label: 'Askıya alındı' };
    case 'PUBLISHED':
      if (Date.parse(offer.validUntil) <= now) {
        return { key: 'expired', label: 'Süresi doldu' };
      }
      if (Date.parse(offer.validFrom) > now) {
        return { key: 'not-started', label: 'Yayında · henüz başlamadı' };
      }
      return { key: 'published', label: 'Yayında' };
  }
}
