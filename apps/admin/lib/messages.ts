import type { AccountStatusErrorCode } from '@gossip/shared';

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
  forbidden: 'Bu panele erişim yetkiniz yok.',
  badRequest: 'İstek doğrulanamadı. Sayfayı yenileyip tekrar deneyin.',
} as const;

export function accountStatusMessage(code: AccountStatusErrorCode): string {
  return code === 'ACCOUNT_PENDING'
    ? messages.accountPending
    : messages.accountSuspended;
}

// Reasons the login page can show after a session was ended. Anything else in
// the query string is ignored, so the page can't be used to display arbitrary text.
export const loginReasons = {
  expired: 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
  forbidden: messages.forbidden,
  inactive: 'Hesabınız artık etkin değil. Lütfen yöneticiyle iletişime geçin.',
  logout: 'Çıkış yaptınız.',
  'logout-local':
    'Bu tarayıcıdaki oturum kapatıldı, ancak sunucudaki oturum iptal edilemedi (sunucuya ulaşılamadı). Oturum süresi dolana kadar sunucuda açık kalabilir.',
} as const;

export type LoginReason = keyof typeof loginReasons;

export function parseLoginReason(
  value: string | undefined,
): LoginReason | undefined {
  return value !== undefined && Object.hasOwn(loginReasons, value)
    ? (value as LoginReason)
    : undefined;
}
