import { ConflictException } from '@nestjs/common';
import type {
  CollaborationError,
  CollaborationErrorCode,
} from '@gossip/shared';

const messages: Record<CollaborationErrorCode, string> = {
  ALREADY_APPLIED:
    'Bu ilana zaten başvurdunuz. Bir ilana yalnızca bir kez başvurulabilir.',
  OFFER_NOT_OPEN: 'Bu ilan şu anda başvuruya veya onaya açık değil.',
  NO_ACTIVE_SUBSCRIPTION:
    'Bu mekanın şu anda geçerli bir aboneliği yok; onay verilemez.',
  OFFER_CAPACITY_FULL: 'İlanın kontenjanı dolu.',
  MONTHLY_QUOTA_EXCEEDED:
    'Mekanın bu aydaki eşleşme kotası doldu (Türkiye saatiyle takvim ayı).',
  APPLICANT_NOT_ELIGIBLE:
    'Başvuran artık etkin bir influencer hesabı değil; onaylanamaz.',
  COLLABORATION_ALREADY_APPROVED: 'Bu başvuru zaten onaylandı; reddedilemez.',
  COLLABORATION_ALREADY_REJECTED: 'Bu başvuru zaten reddedildi; onaylanamaz.',
};

export function collaborationConflict(code: CollaborationErrorCode) {
  return new ConflictException({
    statusCode: 409,
    code,
    message: messages[code],
  } satisfies CollaborationError);
}
