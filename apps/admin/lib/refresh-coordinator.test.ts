import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefreshOutcome } from './api';
import { createRefreshCoordinator } from './refresh-coordinator';

const okOutcome = (n: number): RefreshOutcome => ({
  kind: 'ok',
  tokens: {
    accessToken: `a${n}`,
    accessTokenExpiresAt: '2026-10-10T12:15:00.000Z',
    refreshToken: `r${n}`,
    refreshTokenExpiresAt: '2026-10-17T12:00:00.000Z',
  },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('createRefreshCoordinator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('exchanges a token once for concurrent requests (single-flight)', async () => {
    const gate = deferred<RefreshOutcome>();
    const refresh = vi.fn(() => gate.promise);
    const coordinator = createRefreshCoordinator({ refresh });

    const calls = [
      coordinator.run('rt-1'),
      coordinator.run('rt-1'),
      coordinator.run('rt-1'),
    ];
    gate.resolve(okOutcome(2));

    const results = await Promise.all(calls);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r === results[0])).toBe(true);
  });

  it('serves a late request that still carries the old token from the grace window', async () => {
    const refresh = vi.fn(async () => okOutcome(2));
    const coordinator = createRefreshCoordinator({ refresh, graceMs: 15_000 });

    const first = await coordinator.run('rt-1');
    await vi.advanceTimersByTimeAsync(10_000);
    const late = await coordinator.run('rt-1');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(late).toEqual(first);
  });

  it('forgets the result after the grace window', async () => {
    const refresh = vi.fn(async () => okOutcome(2));
    const coordinator = createRefreshCoordinator({ refresh, graceMs: 15_000 });

    await coordinator.run('rt-1');
    await vi.advanceTimersByTimeAsync(15_001);

    expect(coordinator.size()).toBe(0);
    await coordinator.run('rt-1');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('keeps different tokens (different sessions) independent', async () => {
    const refresh = vi.fn(async (token: string) =>
      okOutcome(token === 'rt-a' ? 1 : 2),
    );
    const coordinator = createRefreshCoordinator({ refresh });

    await Promise.all([coordinator.run('rt-a'), coordinator.run('rt-b')]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('shares a rejection but retries after a temporary failure', async () => {
    const refresh = vi
      .fn<(t: string) => Promise<RefreshOutcome>>()
      .mockResolvedValueOnce({ kind: 'unavailable' })
      .mockResolvedValueOnce({ kind: 'rejected' });
    const coordinator = createRefreshCoordinator({ refresh });

    expect((await coordinator.run('rt-1')).kind).toBe('unavailable');
    expect((await coordinator.run('rt-1')).kind).toBe('rejected');
    expect((await coordinator.run('rt-1')).kind).toBe('rejected');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does not keep a thrown refresh around', async () => {
    const refresh = vi
      .fn<(t: string) => Promise<RefreshOutcome>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(okOutcome(2));
    const coordinator = createRefreshCoordinator({ refresh });

    await expect(coordinator.run('rt-1')).rejects.toThrow('boom');
    expect((await coordinator.run('rt-1')).kind).toBe('ok');
  });

  describe('ending a session (logout)', () => {
    it('answers `ended` for every caller of a refresh that was in flight', async () => {
      const gate = deferred<RefreshOutcome>();
      const refresh = vi.fn(() => gate.promise);
      const coordinator = createRefreshCoordinator({ refresh });

      const first = coordinator.run('rt-1');
      const second = coordinator.run('rt-1');
      coordinator.end('rt-1');
      gate.resolve(okOutcome(2));

      expect(await first).toEqual({ kind: 'ended' });
      expect(await second).toEqual({ kind: 'ended' });
      expect(coordinator.isEnded('rt-1')).toBe(true);
    });

    it('turns a cached result into `ended`, whichever token of the session ends it', async () => {
      const refresh = vi.fn(async () => okOutcome(2));
      const coordinator = createRefreshCoordinator({ refresh });
      await coordinator.run('rt-1'); // rt-1 -> r2

      // Logout happens with the NEW token (the browser already has it).
      coordinator.end('r2');

      expect(await coordinator.run('rt-1')).toEqual({ kind: 'ended' });
      expect(coordinator.isEnded('rt-1')).toBe(true);
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('ends the chain across several rotations', async () => {
      const refresh = vi.fn(async (token: string) =>
        okOutcome(Number(token.slice(1)) + 1),
      );
      const coordinator = createRefreshCoordinator({ refresh });
      await coordinator.run('r1'); // -> r2
      await coordinator.run('r2'); // -> r3

      coordinator.end('r3');

      expect(await coordinator.run('r1')).toEqual({ kind: 'ended' });
      expect(await coordinator.run('r2')).toEqual({ kind: 'ended' });
    });

    it('refuses an unknown token of an ended session without calling the API', async () => {
      const refresh = vi.fn(async () => okOutcome(2));
      const coordinator = createRefreshCoordinator({ refresh });

      coordinator.end('rt-never-seen');

      expect(await coordinator.run('rt-never-seen')).toEqual({ kind: 'ended' });
      expect(refresh).not.toHaveBeenCalled();
    });

    it('leaves other sessions and later logins alone', async () => {
      const refresh = vi.fn(async () => okOutcome(2));
      const coordinator = createRefreshCoordinator({ refresh });

      coordinator.end('rt-old-session');

      expect(coordinator.isEnded('rt-new-session')).toBe(false);
      expect((await coordinator.run('rt-new-session')).kind).toBe('ok');
    });

    it('forgets an ended session after the retention time', async () => {
      const refresh = vi.fn(async () => okOutcome(2));
      const coordinator = createRefreshCoordinator({
        refresh,
        endedRetentionMs: 60_000,
      });
      coordinator.end('rt-1');

      await vi.advanceTimersByTimeAsync(60_001);

      expect(coordinator.isEnded('rt-1')).toBe(false);
      expect(coordinator.size()).toBe(0);
    });

    it('keeps the ended mark when a failed refresh would otherwise clean up', async () => {
      const gate = deferred<RefreshOutcome>();
      const coordinator = createRefreshCoordinator({
        refresh: () => gate.promise,
      });
      const pending = coordinator.run('rt-1');
      coordinator.end('rt-1');
      gate.resolve({ kind: 'unavailable' });
      await pending;

      expect(coordinator.isEnded('rt-1')).toBe(true);
    });
  });
});
