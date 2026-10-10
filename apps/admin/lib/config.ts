// Server-side settings. API_URL is deliberately not NEXT_PUBLIC_*: the browser
// never talks to the API, only the Next.js server does.
export function getApiUrl(): string {
  const url = process.env.API_URL;
  if (url) return url.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('API_URL must be set in production.');
  }
  return 'http://localhost:3000';
}

// Cookies are Secure (and get the __Host- prefix) in production only, because
// plain http://localhost cannot store Secure cookies in every browser.
export function isSecureEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}
