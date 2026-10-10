import { NextResponse, type NextRequest } from 'next/server';
import { apiLogout } from '@/lib/api';
import { isSecureEnvironment } from '@/lib/config';
import { buildClearedCookies, cookieNames } from '@/lib/cookies';
import { parseLoginReason } from '@/lib/messages';

// Server Components can't clear cookies while rendering, so a page that finds
// the session unusable redirects here. It tries to revoke the server session,
// clears the cookies and sends the user to the login page.
export async function GET(request: NextRequest) {
  const reason =
    parseLoginReason(request.nextUrl.searchParams.get('reason') ?? undefined) ??
    'expired';
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: `/login?reason=${reason}`,
      'Cache-Control': 'private, no-store',
    },
  });

  // A link on another site must not be able to sign users out.
  if (request.headers.get('sec-fetch-site') === 'cross-site') return response;

  const secure = isSecureEnvironment();
  const accessToken = request.cookies.get(cookieNames(secure).access)?.value;
  // Best effort: the session may already be gone, or the API unreachable.
  if (accessToken) await apiLogout(accessToken);

  for (const cookie of buildClearedCookies(secure))
    response.cookies.set(cookie);
  return response;
}
