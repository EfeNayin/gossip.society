import type { CreateOfferRequest } from '@gossip/shared';

type RandomSource = { getRandomValues<T extends ArrayBufferView>(array: T): T };

// A version 4 UUID. The key is not a secret (the API scopes it to the signed-in
// user), it only has to be unique per logical create; the platform's random
// source is used when it has one.
export function newIdempotencyKey(
  random: RandomSource | undefined = (globalThis as { crypto?: RandomSource })
    .crypto,
): string {
  const bytes = new Uint8Array(16);
  if (random) random.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * One key per LOGICAL create attempt. Pressing save again with the same
 * content (after a lost answer, a timeout, a 5xx) is the same attempt and
 * sends the same key, so the API can recognize it. Changed content is a new
 * attempt with a new key. After a success the attempt is over: the next save
 * is a new offer on purpose.
 */
export function createAttemptTracker(
  makeKey: () => string = newIdempotencyKey,
) {
  let current: { fingerprint: string; key: string } | null = null;
  return {
    keyFor(request: CreateOfferRequest): string {
      const fingerprint = JSON.stringify(request);
      if (current?.fingerprint !== fingerprint) {
        current = { fingerprint, key: makeKey() };
      }
      return current.key;
    },
    finish() {
      current = null;
    },
  };
}
