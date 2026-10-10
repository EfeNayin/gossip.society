import { describe, expect, it } from 'vitest';
import { checkSameOrigin } from './origin';

const h = (init: Record<string, string>) => new Headers(init);

describe('checkSameOrigin', () => {
  it('accepts a same-origin request', () => {
    expect(
      checkSameOrigin(
        h({
          origin: 'http://localhost:3001',
          host: 'localhost:3001',
          'sec-fetch-site': 'same-origin',
        }),
      ),
    ).toEqual({ ok: true });
  });

  it('accepts when Sec-Fetch-Site is absent but Origin matches Host', () => {
    expect(
      checkSameOrigin(
        h({ origin: 'https://admin.example', host: 'admin.example' }),
      ).ok,
    ).toBe(true);
  });

  it('uses X-Forwarded-Host behind a reverse proxy', () => {
    expect(
      checkSameOrigin(
        h({
          origin: 'https://admin.example',
          host: '10.0.0.5:3001',
          'x-forwarded-host': 'admin.example',
        }),
      ).ok,
    ).toBe(true);
  });

  it('rejects a request without Origin (Next.js alone would let it through)', () => {
    expect(checkSameOrigin(h({ host: 'localhost:3001' })).ok).toBe(false);
  });

  it("rejects an Origin that doesn't match the Host", () => {
    expect(
      checkSameOrigin(
        h({ origin: 'https://evil.example', host: 'admin.example' }),
      ).ok,
    ).toBe(false);
  });

  it.each(['cross-site', 'same-site', 'none'])(
    'rejects Sec-Fetch-Site: %s',
    (site) => {
      expect(
        checkSameOrigin(
          h({
            origin: 'https://admin.example',
            host: 'admin.example',
            'sec-fetch-site': site,
          }),
        ).ok,
      ).toBe(false);
    },
  );

  it.each(['null', 'not a url'])('rejects Origin %j', (origin) => {
    expect(checkSameOrigin(h({ origin, host: 'admin.example' })).ok).toBe(
      false,
    );
  });
});
