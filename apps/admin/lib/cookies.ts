// Session cookie definitions, shared by the proxy, Server Actions and Route
// Handlers so every place sets and clears them identically.
//
// Both cookies are HttpOnly (not readable by page JavaScript), SameSite=Lax
// (not sent on cross-site POSTs, which is what state-changing requests are),
// Path=/ and Secure in production. Their Expires is exactly the expiry the API
// reported, so a cookie never outlives the token or session it carries.

export interface CookieSpec {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  expires: Date;
}

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export function cookieNames(secure: boolean) {
  // The __Host- prefix makes browsers require Secure + Path=/ and no Domain.
  const prefix = secure ? '__Host-' : '';
  return {
    access: `${prefix}gs_admin_at`,
    refresh: `${prefix}gs_admin_rt`,
  } as const;
}

export function buildSessionCookies(
  tokens: SessionTokens,
  secure: boolean,
): CookieSpec[] {
  const names = cookieNames(secure);
  const common = {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  } as const;
  return [
    {
      ...common,
      name: names.access,
      value: tokens.accessToken,
      expires: new Date(tokens.accessTokenExpiresAt),
    },
    {
      ...common,
      name: names.refresh,
      value: tokens.refreshToken,
      expires: new Date(tokens.refreshTokenExpiresAt),
    },
  ];
}

export function buildClearedCookies(secure: boolean): CookieSpec[] {
  const names = cookieNames(secure);
  const common = {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  } as const;
  const gone = new Date(0);
  return [
    { ...common, name: names.access, value: '', expires: gone },
    { ...common, name: names.refresh, value: '', expires: gone },
  ];
}
