import { idempotencyKeySchema } from '@gossip/shared';
import { describe, expect, it } from 'vitest';
import { createAttemptTracker, newIdempotencyKey } from './idempotency-key';
import { offerRequest } from './test-support';

const BRANCH = '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a11';

describe('newIdempotencyKey', () => {
  it('is a version 4 UUID that the API accepts', () => {
    for (let i = 0; i < 50; i++) {
      const key = newIdempotencyKey();
      expect(key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(idempotencyKeySchema.safeParse(key).success).toBe(true);
    }
  });

  it('does not repeat', () => {
    const keys = new Set(
      Array.from({ length: 1000 }, () => newIdempotencyKey()),
    );
    expect(keys.size).toBe(1000);
  });

  it('uses the platform random source when there is one, and works without', () => {
    const source = {
      getRandomValues: <T extends ArrayBufferView>(array: T): T => {
        (array as unknown as Uint8Array).fill(0xab);
        return array;
      },
    };
    expect(newIdempotencyKey(source)).toBe(
      'abababab-abab-4bab-abab-abababababab',
    );
    // No crypto at all (an engine without it): falls back, still a valid key.
    const noCrypto = (globalThis as { crypto?: unknown }).crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
    });
    try {
      expect(idempotencyKeySchema.safeParse(newIdempotencyKey()).success).toBe(
        true,
      );
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: noCrypto,
        configurable: true,
      });
    }
  });
});

describe('createAttemptTracker', () => {
  const tracker = () => {
    let n = 0;
    return createAttemptTracker(() => `key-${++n}`);
  };

  it('gives the same key to the same content, again and again', () => {
    const t = tracker();
    const first = t.keyFor(offerRequest(BRANCH));
    expect(t.keyFor(offerRequest(BRANCH))).toBe(first);
    expect(t.keyFor(offerRequest(BRANCH))).toBe(first);
  });

  it.each([
    ['title', { title: 'Başka' }],
    ['value', { serviceValueKurus: 250_001 }],
    ['capacity', { capacity: 3 }],
    ['end', { validUntil: '2026-12-02T06:00:00.000Z' }],
    ['branch', { branchId: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a12' }],
  ])('starts a new attempt when the %s changes', (_n, change) => {
    const t = tracker();
    const first = t.keyFor(offerRequest(BRANCH));
    const changed = t.keyFor(offerRequest(BRANCH, change));
    expect(changed).not.toBe(first);
    // Changing it back is not the first attempt any more either: the first key
    // belongs to content the user abandoned.
    expect(t.keyFor(offerRequest(BRANCH))).not.toBe(first);
  });

  it('after a success the next save is a new create, even with the same content', () => {
    const t = tracker();
    const first = t.keyFor(offerRequest(BRANCH));
    t.finish();
    expect(t.keyFor(offerRequest(BRANCH))).not.toBe(first);
  });
});
