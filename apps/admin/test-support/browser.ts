import { NextRequest } from 'next/server';
import { cookieNames } from '@/lib/cookies';
import { RedirectError, requestContext } from './next-mocks';

const names = cookieNames(false);
export const AT = names.access;
export const RT = names.refresh;

export interface Handled {
  // The proxy's own answer.
  proxy: Response;
  // Cookies the proxy set in the response.
  proxySetCookies: string[];
  // Where the request ended up, if it redirected (proxy or Server Action).
  redirectedTo?: string;
  // Header the proxy forwarded to the page.
  authState: string | null;
}

/**
 * A browser with a cookie jar that runs a request through the real proxy and
 * then through the page or Server Action. Cookie changes are applied to the
 * jar in the order a real response carries them (proxy first, then the action).
 */
export class FakeBrowser {
  jar = new Map<string, string>();

  constructor(
    private readonly proxy: (request: NextRequest) => Promise<Response>,
  ) {}

  cookieHeader(only?: string[]) {
    return [...this.jar]
      .filter(([name]) => !only || only.includes(name))
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  private applySetCookies(setCookies: string[]) {
    for (const line of setCookies) {
      const [pair = ''] = line.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (!value || /expires=thu, 01 jan 1970/i.test(line))
        this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }

  async send(
    options: {
      method?: 'GET' | 'POST';
      path?: string;
      // Send only these jar cookies (e.g. a request that left the browser before
      // the access cookie was renewed).
      onlyCookies?: string[];
      // Extra / overriding headers (Origin etc.). POSTs get a same-origin Origin.
      headers?: Record<string, string>;
      // Runs the page or Server Action after the proxy let the request through.
      handler?: () => Promise<unknown>;
      // Cookies to send instead of the jar's (a stale in-flight request).
      cookies?: Record<string, string>;
    } = {},
  ): Promise<Handled> {
    const method = options.method ?? 'GET';
    const cookie = options.cookies
      ? Object.entries(options.cookies)
          .map(([n, v]) => `${n}=${v}`)
          .join('; ')
      : this.cookieHeader(options.onlyCookies);
    const headers = new Headers({
      host: 'localhost:3001',
      ...(cookie ? { cookie } : {}),
      ...(method === 'POST'
        ? { origin: 'http://localhost:3001', 'sec-fetch-site': 'same-origin' }
        : {}),
      ...options.headers,
    });
    const request = new NextRequest(
      `http://localhost:3001${options.path ?? '/'}`,
      { method, headers },
    );

    const response = await this.proxy(request);
    const proxySetCookies = response.headers.getSetCookie();
    const result: Handled = {
      proxy: response,
      proxySetCookies,
      authState: response.headers.get('x-middleware-request-x-gs-auth-state'),
    };

    // Responses of this proxy are redirects or "continue" (x-middleware-next).
    if (response.headers.get('x-middleware-next') !== '1') {
      this.applySetCookies(proxySetCookies);
      result.redirectedTo =
        new URL(response.headers.get('location') ?? '', 'http://localhost:3001')
          .pathname +
        new URL(response.headers.get('location') ?? '', 'http://localhost:3001')
          .search;
      return result;
    }

    // What the page / action sees: the (possibly renewed) cookie header and
    // the headers the proxy forwarded.
    const forwarded = new Headers(headers);
    for (const key of (
      response.headers.get('x-middleware-override-headers') ?? ''
    ).split(',')) {
      const value = response.headers.get(`x-middleware-request-${key}`);
      if (key && value !== null) forwarded.set(key, value);
    }
    if (
      !(response.headers.get('x-middleware-override-headers') ?? '')
        .split(',')
        .includes('x-gs-auth-state')
    ) {
      forwarded.delete('x-gs-auth-state');
    }
    requestContext.reset();
    requestContext.headers = forwarded;
    for (const part of (forwarded.get('cookie') ?? '')
      .split('; ')
      .filter(Boolean)) {
      const eq = part.indexOf('=');
      requestContext.cookies.set(part.slice(0, eq), part.slice(eq + 1));
    }

    this.applySetCookies(proxySetCookies);
    if (options.handler) {
      try {
        await options.handler();
      } catch (error) {
        if (!(error instanceof RedirectError)) throw error;
        result.redirectedTo = error.url;
      }
      for (const spec of requestContext.outgoing) {
        if (spec.value === '' || spec.expires.getTime() === 0)
          this.jar.delete(spec.name);
        else this.jar.set(spec.name, spec.value);
      }
    }
    return result;
  }
}
