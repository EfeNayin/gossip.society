import { ForbiddenException } from '@nestjs/common';
import type {
  AccountStatusError,
  AccountStatusErrorCode,
  SafeUser,
} from '@gossip/shared';

const blocked: Record<
  Exclude<SafeUser['status'], 'ACTIVE'>,
  { code: AccountStatusErrorCode; message: string }
> = {
  PENDING: {
    code: 'ACCOUNT_PENDING',
    message: 'Hesabınız henüz onaylanmadı.',
  },
  SUSPENDED: {
    code: 'ACCOUNT_SUSPENDED',
    message: 'Hesabınız askıya alındı.',
  },
};

/** Throws a 403 with a machine-readable code unless the account is ACTIVE. */
export function assertAccountActive(user: Pick<SafeUser, 'status'>): void {
  if (user.status === 'ACTIVE') return;
  throw new ForbiddenException({
    statusCode: 403,
    ...blocked[user.status],
  } satisfies AccountStatusError);
}
