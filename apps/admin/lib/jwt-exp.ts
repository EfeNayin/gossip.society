/**
 * Reads `exp` (seconds since epoch) from a JWT payload WITHOUT verifying the
 * signature. It is only used to decide when to refresh; the API verifies every
 * token it receives.
 */
export function readJwtExp(token: string): number | undefined {
  const payload = token.split('.')[1];
  if (!payload) return undefined;
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
    if (typeof claims === 'object' && claims !== null && 'exp' in claims) {
      const exp = (claims as { exp: unknown }).exp;
      if (typeof exp === 'number' && Number.isFinite(exp)) return exp;
    }
  } catch {
    // Not a decodable token: treated as expired by the caller.
  }
  return undefined;
}

// Refresh slightly before the real expiry so a token isn't sent to the API
// just as it expires (and to absorb small clock differences).
export const ACCESS_EXPIRY_SKEW_SECONDS = 30;

export function isAccessTokenUsable(
  token: string | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!token) return false;
  const exp = readJwtExp(token);
  return (
    exp !== undefined && exp * 1000 - nowMs > ACCESS_EXPIRY_SKEW_SECONDS * 1000
  );
}
