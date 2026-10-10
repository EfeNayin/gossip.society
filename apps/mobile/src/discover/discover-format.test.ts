import { describe, expect, it } from 'vitest';
import { followerCondition } from './discover-format';

describe('followerCondition', () => {
  it.each([
    [0, 'Takipçi şartı yok'],
    [5000, 'Minimum 5.000 takipçi'],
    [1_250_000, 'Minimum 1.250.000 takipçi'],
  ])('%d -> %s', (value, text) => {
    expect(followerCondition(value)).toBe(text);
  });
});
