// CSRF defence for state-changing requests that carry cookies.
//
// Next.js already rejects Server Action requests whose Origin host differs from
// the Host, but lets a request with NO Origin header through (with a warning).
// This check is stricter: the Origin must be present and match, and a browser
// that says the request is cross-site (Sec-Fetch-Site) is refused outright.
// Together with SameSite=Lax cookies and POST-only mutations this closes the
// cross-site forgery paths.

export type OriginCheck = { ok: true } | { ok: false; reason: string };

export function checkSameOrigin(headers: Pick<Headers, 'get'>): OriginCheck {
  const site = headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') {
    return { ok: false, reason: 'cross-site request' };
  }

  const origin = headers.get('origin');
  if (!origin) return { ok: false, reason: 'missing Origin header' };

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return { ok: false, reason: 'invalid Origin header' };
  }

  // Behind a reverse proxy the public host arrives as X-Forwarded-Host, as
  // Next.js itself assumes for its own Server Action check.
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host || host.toLowerCase() !== originHost.toLowerCase()) {
    return { ok: false, reason: 'Origin does not match Host' };
  }
  return { ok: true };
}
