import { ConflictException, NotFoundException } from '@nestjs/common';
import type { OfferError, OfferErrorCode } from '@gossip/shared';

const messages: Record<OfferErrorCode, string> = {
  NO_ACTIVE_SUBSCRIPTION:
    'Bu mekanın şu anda geçerli bir aboneliği yok; ilan yayınlanamaz.',
  QUOTA_EXCEEDED: 'Aboneliğinizin aktif ilan kotası doldu.',
  OFFER_NOT_DRAFT:
    'Yalnızca taslak ilanlar düzenlenebilir veya yayınlanabilir.',
  OFFER_EXPIRED: 'İlanın geçerlilik süresi bitmiş; yayınlanamaz.',
  OFFER_NOT_PUBLISHED: 'Yalnızca yayındaki ilanlar askıya alınabilir.',
  IDEMPOTENCY_KEY_REUSED:
    'Bu Idempotency-Key daha önce farklı bir istek için kullanılmış.',
};

export function offerConflict(code: OfferErrorCode) {
  return new ConflictException({
    statusCode: 409,
    code,
    message: messages[code],
  } satisfies OfferError);
}

// Someone else's offer or branch looks exactly like one that doesn't exist.
export const offerNotFound = () => new NotFoundException('İlan bulunamadı.');
export const branchNotFound = () => new NotFoundException('Şube bulunamadı.');
