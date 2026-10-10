import { describe, expect, it } from 'vitest';
import { parseStoredSession, serializeSession } from './stored-session';

const session = {
  accessToken: 'access',
  accessExpiresAt: 1_000,
  refreshToken: 'refresh',
  refreshExpiresAt: 2_000,
};

describe('stored session', () => {
  it('round-trips both tokens as one value', () => {
    const raw = serializeSession(session);
    expect(typeof raw).toBe('string');
    expect(parseStoredSession(raw)).toEqual(session);
  });

  it.each([
    ['null', null],
    ['empty', ''],
    ['not JSON', '{oops'],
    ['not an object', '"text"'],
    ['old format (no version)', JSON.stringify(session)],
    ['future version', JSON.stringify({ v: 2, ...session })],
    [
      'missing refresh token',
      JSON.stringify({ v: 1, ...session, refreshToken: undefined }),
    ],
    [
      'missing access token',
      JSON.stringify({ v: 1, ...session, accessToken: undefined }),
    ],
    ['empty token', JSON.stringify({ v: 1, ...session, refreshToken: '' })],
    [
      'non-numeric expiry',
      JSON.stringify({ v: 1, ...session, accessExpiresAt: 'soon' }),
    ],
    ['half-written value', serializeSession(session).slice(0, 40)],
  ])('treats %s as no session', (_label, raw) => {
    expect(parseStoredSession(raw)).toBeNull();
  });
});
