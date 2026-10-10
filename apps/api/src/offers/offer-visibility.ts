/**
 * An offer is open (visible to influencers, and open for applications and
 * approvals) when it is PUBLISHED and validFrom <= now < validUntil. ONE
 * definition for discovery, applying and approving; `now` is read by the caller
 * once per transaction.
 */
export const visibleAt = (now: Date) => ({
  status: 'PUBLISHED' as const,
  validFrom: { lte: now },
  validUntil: { gt: now },
});
