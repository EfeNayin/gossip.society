import type { OfferErrorCode } from '@gossip/shared';

// User-facing texts are Turkish.
export const offerErrorMessages: Record<OfferErrorCode, string> = {
  NO_ACTIVE_SUBSCRIPTION:
    'Bu mekanın şu anda geçerli bir aboneliği yok; ilan yayınlanamaz.',
  QUOTA_EXCEEDED: 'Aboneliğinizin aktif ilan kotası doldu.',
  OFFER_NOT_DRAFT:
    'Bu ilan artık taslak değil; düzenlenemez veya yeniden yayınlanamaz.',
  OFFER_EXPIRED: 'İlanın geçerlilik süresi bitmiş; yayınlanamaz.',
  OFFER_NOT_PUBLISHED: 'Yalnızca yayındaki ilanlar bu işleme uygundur.',
};

export const offerMessages = {
  // The answer was lost or the server failed: we can't tell if it happened.
  unknownOutcome:
    'Sunucudan yanıt alınamadı; işlemin tamamlanıp tamamlanmadığı bilinmiyor. Tekrar denemeden önce ilanın durumunu yenileyerek kontrol edin.',
  invalid:
    'Girilen bilgiler sunucu tarafından kabul edilmedi. Alanları kontrol edin.',
  notFound: 'Bu ilan bulunamadı ya da size ait değil.',
  forbidden:
    'Bu işlem için yetkiniz değişmiş olabilir. Hesap bilgileriniz kontrol ediliyor…',
  loadFailed: 'İlanlarınız şu anda alınamadı. Lütfen tekrar deneyin.',
  unreachable:
    'Sunucuya ulaşılamıyor. Bağlantınızı kontrol edip tekrar deneyin.',
} as const;
