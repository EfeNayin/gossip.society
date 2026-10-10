'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginRequestSchema } from '@gossip/shared';
import { apiLogin, apiLogout, apiMe } from '@/lib/api';
import { isSecureEnvironment } from '@/lib/config';
import {
  buildClearedCookies,
  buildSessionCookies,
  cookieNames,
} from '@/lib/cookies';
import { accountStatusMessage, messages } from '@/lib/messages';
import { checkSameOrigin } from '@/lib/origin';
import { getRefreshCoordinator } from '@/lib/refresh-coordinator';
import { getAdminSession } from '@/lib/session';
import { classifyMe, endReasonFor } from '@/lib/session-state';

export type LoginState = { error?: string; email?: string };

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // CSRF: refuse anything that doesn't come from this site's own pages.
  if (!checkSameOrigin(await headers()).ok) {
    return { error: messages.badRequest };
  }

  const submittedEmail = formData.get('email');
  const email = typeof submittedEmail === 'string' ? submittedEmail : '';
  const parsed = loginRequestSchema.safeParse({
    email: submittedEmail,
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: messages.invalidForm, email };

  const login = await apiLogin(parsed.data);
  if (login.kind === 'unreachable')
    return { error: messages.unreachable, email };
  if (login.kind === 'error') {
    if (login.status === 401)
      return { error: messages.invalidCredentials, email };
    if (login.status === 403 && login.code) {
      return { error: accountStatusMessage(login.code), email };
    }
    if (login.status === 429) return { error: messages.rateLimited, email };
    if (login.status === 400) return { error: messages.invalidForm, email };
    return { error: messages.unexpected, email };
  }

  const {
    accessToken,
    accessTokenExpiresAt,
    refreshToken,
    refreshTokenExpiresAt,
  } = login.data;

  // Ask the API who this really is; only an ACTIVE ADMIN gets cookies.
  const session = classifyMe(await apiMe(accessToken));
  if (session.kind === 'unavailable')
    return { error: messages.unreachable, email };
  if (session.kind !== 'ok') {
    // The login created a server session; revoke it instead of just dropping it.
    // If that fails the tokens are discarded here anyway and nobody holds them.
    await apiLogout(accessToken);
    return {
      error:
        session.kind === 'inactive'
          ? messages.accountSuspended
          : messages.forbidden,
      email,
    };
  }

  const cookieStore = await cookies();
  for (const cookie of buildSessionCookies(
    { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt },
    isSecureEnvironment(),
  )) {
    cookieStore.set(cookie);
  }
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  // A forged cross-site logout does nothing.
  if (!checkSameOrigin(await headers()).ok) redirect('/');

  const secure = isSecureEnvironment();
  const names = cookieNames(secure);
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(names.access)?.value;
  const refreshToken = cookieStore.get(names.refresh)?.value;

  // First, mark the session as ended for this process: from this moment on no
  // refresh result of this session (cached, or still in flight in the proxy)
  // may write cookies again. Only then talk to the API.
  if (refreshToken) getRefreshCoordinator().end(refreshToken);

  // The proxy has already renewed an expired access token for this request. If
  // it couldn't (API unreachable) there's no token to authorize the call with.
  let serverSessionEnded = false;
  if (accessToken) {
    const result = await apiLogout(accessToken);
    // 401 means the session was already revoked or expired: nothing left to end.
    serverSessionEnded =
      result.kind === 'ok' ||
      (result.kind === 'error' && result.status === 401);
  }

  // Local cookies are cleared either way; the message tells the truth about the server.
  for (const cookie of buildClearedCookies(secure)) cookieStore.set(cookie);
  redirect(
    serverSessionEnded ? '/login?reason=logout' : '/login?reason=logout-local',
  );
}

/**
 * Ends a session that is no longer usable (expired, revoked, or of someone who
 * may not use the panel) and clears its cookies. It is a POST Server Action so
 * that it needs the same-origin check; the GET page that leads here changes
 * nothing. It acts only on the browser's current cookies and only when they
 * really are unusable, so it can't be used to sign out a valid admin.
 */
export async function endInvalidSessionAction(): Promise<void> {
  if (!checkSameOrigin(await headers()).ok) redirect('/');

  const reason = endReasonFor(await getAdminSession());
  // Valid session (e.g. the proxy renewed it for this very request) or API
  // down: there is nothing to end.
  if (!reason) redirect('/');

  const secure = isSecureEnvironment();
  const names = cookieNames(secure);
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(names.access)?.value;
  const refreshToken = cookieStore.get(names.refresh)?.value;

  if (refreshToken) getRefreshCoordinator().end(refreshToken);
  // Best effort: the session may already be gone, or the API unreachable. The
  // user of a forbidden/inactive account still has a live server session.
  if (accessToken) await apiLogout(accessToken);

  for (const cookie of buildClearedCookies(secure)) cookieStore.set(cookie);
  redirect(`/login?reason=${reason}`);
}
