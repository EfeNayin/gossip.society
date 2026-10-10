import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiMocks } from '../../../test-support/api-mock';
import { FakeBackend } from '../../../test-support/fake-backend';
import {
  RedirectError,
  requestContext,
} from '../../../test-support/next-mocks';
import { cookieNames } from '@/lib/cookies';
import { getRefreshCoordinator } from '@/lib/refresh-coordinator';
import { SessionEnd } from './session-end';

vi.mock('@/lib/api', async (importOriginal) => {
  const { apiMocks } = await import('../../../test-support/api-mock');
  return { ...(await importOriginal<object>()), ...apiMocks };
});

const { access: AT, refresh: RT } = cookieNames(false);

describe('GET /session/end (the page)', () => {
  let backend: FakeBackend;

  beforeEach(() => {
    backend = new FakeBackend().install();
  });

  it('has no route handler, so no HTTP method of this path can change anything on its own', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else files.push(name);
      }
    };
    walk(join(__dirname, '..'));
    expect(files.filter((name) => /^route\.(t|j)sx?$/.test(name))).toEqual([]);
  });

  it('shows the transition for an unusable session without writing cookies, calling logout or ending anything', async () => {
    const { accessToken, refreshToken, session } = backend.login();
    session.revoked = true;
    requestContext.cookies.set(AT, accessToken);
    requestContext.cookies.set(RT, refreshToken);

    const view = await SessionEnd();

    expect(view).toBeTruthy();
    expect(requestContext.outgoing).toEqual([]);
    expect(apiMocks.apiLogout).not.toHaveBeenCalled();
    expect(getRefreshCoordinator().isEnded(refreshToken)).toBe(false);
  });

  it('with no cookies at all is also side-effect free', async () => {
    await SessionEnd();
    expect(requestContext.outgoing).toEqual([]);
    expect(apiMocks.apiLogout).not.toHaveBeenCalled();
  });

  it('sends a valid session back to the panel and leaves it alone', async () => {
    const { accessToken, refreshToken, session } = backend.login();
    requestContext.cookies.set(AT, accessToken);
    requestContext.cookies.set(RT, refreshToken);

    await expect(SessionEnd()).rejects.toMatchObject({ url: '/' });
    await expect(SessionEnd()).rejects.toBeInstanceOf(RedirectError);

    expect(requestContext.outgoing).toEqual([]);
    expect(session.revoked).toBe(false);
  });
});
