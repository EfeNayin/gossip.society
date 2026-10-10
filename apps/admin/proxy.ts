import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_STATE, AUTH_STATE_HEADER } from '@/lib/auth-state';
import { isSecureEnvironment } from '@/lib/config';
import { buildSessionCookies, cookieNames } from '@/lib/cookies';
import { decideProxyAction } from '@/lib/proxy-decision';
import { getRefreshCoordinator } from '@/lib/refresh-coordinator';

// The one place where tokens are renewed. Server Components can't write
// cookies, and funnelling every renewal through here lets the coordinator make
// sure a refresh token is exchanged only once per process (see its notes for
// the single-instance limit). The coordinator is shared with the Server
// Actions through globalThis: Next.js bundles this file separately, so a
// module-level instance would not be the one logout talks to.
//
// This file never clears cookies: a response to a request that was already in
// flight could otherwise delete the cookies of a login made in the meantime.
// Clearing is done by the end-session Server Action, which sees the browser's
// current cookies.
export async function proxy(request: NextRequest) {
  const secure = isSecureEnvironment();
  const names = cookieNames(secure);
  const coordinator = getRefreshCoordinator();

  // The browser must never be able to set internal headers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(AUTH_STATE_HEADER);

  const accessToken = request.cookies.get(names.access)?.value;
  const refreshToken = request.cookies.get(names.refresh)?.value;
  const decision = decideProxyAction({
    pathname: request.nextUrl.pathname,
    accessToken,
    refreshToken,
  });

  if (decision.kind === 'redirect') {
    const url = request.nextUrl.clone();
    url.pathname = decision.to;
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (decision.kind === 'pass' || !refreshToken) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const outcome = await coordinator.run(refreshToken);

  // Everything from here to the end of the `ok` branch is synchronous. A
  // logout can't run in between, so "still not ended" at this check really is
  // still true when the cookies are written.
  if (outcome.kind === 'ok' && !coordinator.isEnded(refreshToken)) {
    // Make the renewed tokens visible to this very request (Server Components
    // and Server Actions read them with cookies()), and store them in the browser.
    const cookies = buildSessionCookies(outcome.tokens, secure);
    for (const cookie of cookies)
      request.cookies.set(cookie.name, cookie.value);
    requestHeaders.set('cookie', request.cookies.toString());
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    for (const cookie of cookies) response.cookies.set(cookie);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }

  // The API is unreachable or busy: keep the cookies and let the page say so.
  if (outcome.kind === 'unavailable') {
    requestHeaders.set(AUTH_STATE_HEADER, AUTH_STATE.unavailable);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Refresh refused, or the session was ended here while this was in flight:
  // no session for these tokens. Touch no cookies; the page sends the visitor
  // to the end-session step, which works on the browser's current cookies.
  requestHeaders.set(AUTH_STATE_HEADER, AUTH_STATE.none);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
