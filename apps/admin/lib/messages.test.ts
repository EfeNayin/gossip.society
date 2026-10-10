import { describe, expect, it } from 'vitest';
import {
  accountStatusMessage,
  loginReasons,
  messages,
  parseLoginReason,
} from './messages';

describe('accountStatusMessage', () => {
  it('distinguishes pending from suspended', () => {
    expect(accountStatusMessage('ACCOUNT_PENDING')).toBe(
      messages.accountPending,
    );
    expect(accountStatusMessage('ACCOUNT_SUSPENDED')).toBe(
      messages.accountSuspended,
    );
    expect(messages.accountPending).not.toBe(messages.accountSuspended);
  });
});

describe('parseLoginReason', () => {
  it.each(Object.keys(loginReasons))('accepts %s', (reason) => {
    expect(parseLoginReason(reason)).toBe(reason);
  });

  it.each([undefined, '', '<script>', 'toString', '__proto__', 'constructor'])(
    "ignores %j so arbitrary text can't be injected",
    (reason) => {
      expect(parseLoginReason(reason)).toBeUndefined();
    },
  );
});
