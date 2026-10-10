import { NextResponse, type NextRequest } from 'next/server';
import { apiRefresh } from '@/lib/api';
import { isSecureEnvironment } from '@/lib/config';
import {
  buildClearedCookies,
  buildSessionCookies,
  cookieNames,
} from '@/lib/cookies';
import { decideProxyAction } from '@/lib/proxy-decision';
import { createRefreshCoordinator } from '@/lib/refresh-coordinator';

// Must match lib/session.ts (not imported from there: that file pulls in
// next/headers, which the proxy can't use).
const AUTH_STATE_HEADER = 'x-gs-auth-state';

// The one place where tokens are renewed. Server Components can't write
// cookies, and funnelling every renewal through here lets the coordinator make
// sure a refresh token is exchanged only once per process (see its notes for
// the single-instance limit).
const coordinator = createRefreshCoordinator({ refresh: apiRefresh });

export async function proxy(request: NextRequest) {
  const secure = isSecureEnvironment();
  const names = cookieNames(secure);

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

  if (outcome.kind === 'ok') {
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

  if (outcome.kind === 'rejected') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '?reason=expired';
    const response = NextResponse.redirect(url);
    for (const cookie of buildClearedCookies(secure))
      response.cookies.set(cookie);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }

  // The API is unreachable or busy: keep the cookies and let the page say so.
  requestHeaders.set(AUTH_STATE_HEADER, 'unavailable');
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
