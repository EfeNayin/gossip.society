import { createHash, randomBytes } from 'node:crypto';

/**
 * Opaque refresh token: 32 random bytes (256 bits), base64url encoded. It is
 * not a JWT, so it can never be accepted as a Bearer access token. Only the
 * hash is stored; the raw value exists in memory and in the response body.
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

// A plain SHA-256 is enough because the input is high-entropy random data.
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
