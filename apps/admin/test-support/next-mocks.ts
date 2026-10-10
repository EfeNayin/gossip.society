import type { CookieSpec } from '@/lib/cookies';

// Stand-ins for next/headers and next/navigation, installed for every test by
// vitest.setup.ts. A test describes the request being handled through
// `requestContext`; whatever the code under test writes ends up in `outgoing`.
//
// Everything lives on globalThis because tests reload modules to imitate
// Next.js bundling the proxy and the actions separately: a reloaded copy of this
// file must still see the same context and throw the same error class.
const KEY = Symbol.for('gossip-society.admin.test.next-mocks');

class RedirectErrorImpl extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

function create() {
  return {
    RedirectError: RedirectErrorImpl,
    context: {
      cookies: new Map<string, string>(),
      headers: new Headers(),
      // Cookie writes made through cookies().set(...) by Server Actions.
      outgoing: [] as CookieSpec[],
      reset() {
        this.cookies = new Map();
        this.headers = new Headers();
        this.outgoing = [];
      },
    },
  };
}

const shared = ((globalThis as Record<symbol, unknown>)[KEY] ??=
  create()) as ReturnType<typeof create>;

export const RedirectError = shared.RedirectError;
export const requestContext = shared.context;

export function cookieStore() {
  return {
    get: (name: string) => {
      const value = requestContext.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (spec: CookieSpec) => {
      requestContext.outgoing.push(spec);
    },
  };
}

export const headersStore = () => requestContext.headers;
