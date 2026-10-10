import type { AccountStatusErrorCode } from '@gossip/shared';
import type { Notice } from './types';

// User-facing texts are Turkish.
export const messages = {
  invalidCredentials: 'E-posta veya parola hatalı.',
  invalidForm: 'Geçerli bir e-posta adresi ve parola girin.',
  accountPending: 'Hesabınız henüz onaylanmadı.',
  accountSuspended:
    'Hesabınız askıya alınmış. Lütfen yöneticiyle iletişime geçin.',
  rateLimited:
    'Çok fazla deneme yaptınız. Lütfen biraz bekleyip tekrar deneyin.',
  unreachable:
    'Sunucuya ulaşılamıyor. Bağlantınızı kontrol edip tekrar deneyin.',
  unexpected: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
  adminWeb:
    'Yönetim paneli web üzerinden kullanılır. Mobil uygulamada yönetici girişi yoktur.',
} as const;

export function accountStatusMessage(code: AccountStatusErrorCode): string {
  return code === 'ACCOUNT_PENDING'
    ? messages.accountPending
    : messages.accountSuspended;
}

export const noticeMessages: Record<Notice, string> = {
  'admin-web': messages.adminWeb,
  expired: 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
  inactive: 'Hesabınız artık etkin değil. Lütfen yöneticiyle iletişime geçin.',
  logout: 'Çıkış yaptınız.',
  'logout-local':
    'Bu cihazdaki oturum kapatıldı, ancak sunucudaki oturum iptal edilemedi (sunucuya ulaşılamadı). Oturum süresi dolana kadar sunucuda açık kalabilir.',
};

export const roleLabels = {
  INFLUENCER: 'Influencer',
  VENUE_OWNER: 'Mekan Sahibi',
  VENUE_STAFF: 'Mekan Personeli',
  ADMIN: 'Yönetici',
} as const;
