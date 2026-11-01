import { ApiError } from '@oakestra/api';
import { createMockToken } from '@oakestra/mocks';
import { describe, expect, it, vi } from 'vitest';

import { createAuthSession, ORGANIZATION_NAME_KEY, REFRESH_TOKEN_KEY } from './session';

const NOW = 1_800_000_000_000;

function token(options: { ttl?: number; roles?: string[]; type?: 'access' | 'refresh' } = {}) {
  return createMockToken(
    { sub: 'alice', roles: options.roles ?? ['Application_Provider'], organization: 'org-1' },
    { type: options.type ?? 'access', ttlSeconds: options.ttl ?? 600, now: NOW },
  );
}

const rejected = (status = 401) =>
  new ApiError('expired', { kind: 'http', status, method: 'POST', path: '/auth/refresh' });

function setup(refresh = vi.fn(() => Promise.resolve(token()))) {
  const session = createAuthSession({ storage: window.localStorage, refresh, now: () => NOW });
  return { session, refresh };
}

describe('auth session', () => {
  it('derives the user from the access token and stores only the refresh token', async () => {
    const { session, refresh } = setup();
    session.login({ token: token(), refresh_token: 'refresh-1' }, 'edge-lab');

    expect(session.store.getState().user).toEqual({
      username: 'alice',
      roles: ['Application_Provider'],
      organization: 'org-1',
      organizationName: 'edge-lab',
    });
    expect(window.localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1');
    expect(window.localStorage.getItem(ORGANIZATION_NAME_KEY)).toBe('edge-lab');
    expect(JSON.stringify(window.localStorage)).not.toContain(token().split('.')[1]);
    expect(await session.getAccessToken()).toEqual(expect.any(String));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes once for concurrent callers when the token is about to expire', async () => {
    const { session, refresh } = setup();
    session.login({ token: token({ ttl: 20 }), refresh_token: 'refresh-1' });
    const user = session.store.getState().user;

    const tokens = await Promise.all([session.getAccessToken(), session.getAccessToken()]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith('refresh-1');
    expect(tokens[0]).toBe(tokens[1]);
    // Same claims, same object: consumers keyed on the user do not re-render on every refresh.
    expect(session.store.getState().user).toBe(user);
  });

  it('restores a session from the stored refresh token after a reload', async () => {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, 'stored');
    const { session, refresh } = setup();
    expect(session.store.getState().status).toBe('anonymous');

    expect(await session.ensureSession()).toBe(true);
    expect(refresh).toHaveBeenCalledWith('stored');
    expect(session.store.getState().user?.organizationName).toBe('root');
  });

  it('ends the session when the refresh token is rejected', async () => {
    const { session } = setup(vi.fn(() => Promise.reject(rejected())));
    session.login({ token: token({ ttl: 5 }), refresh_token: 'refresh-1' });

    expect(await session.getAccessToken()).toBeNull();
    expect(session.store.getState()).toMatchObject({
      status: 'anonymous',
      user: null,
      lastLogoutReason: 'expired',
    });
    expect(window.localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('keeps the session when the backend is just unreachable', async () => {
    const network = new ApiError('offline', {
      kind: 'network',
      status: 0,
      method: 'POST',
      path: '/',
    });
    const { session } = setup(vi.fn(() => Promise.reject(network)));
    session.login({ token: token({ ttl: 5 }), refresh_token: 'refresh-1' });

    await expect(session.getAccessToken()).rejects.toBe(network);
    expect(session.store.getState().status).toBe('authenticated');
  });

  it('does not refresh twice when another request already replaced the rejected token', async () => {
    const { session, refresh } = setup();
    session.login({ token: token(), refresh_token: 'refresh-1' });
    const current = await session.getAccessToken();

    expect(await session.refreshAfterUnauthorized('an-older-token')).toBe(current);
    expect(refresh).not.toHaveBeenCalled();
    expect(await session.refreshAfterUnauthorized(current!)).not.toBe(current);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('ignores a refresh that finishes after logout', async () => {
    let resolve: (value: string) => void = () => {};
    const { session } = setup(vi.fn(() => new Promise<string>((r) => (resolve = r))));
    session.login({ token: token({ ttl: 5 }), refresh_token: 'refresh-1' });

    const pending = session.getAccessToken();
    session.logout('user');
    resolve(token());

    expect(await pending).toBeNull();
    expect(session.store.getState().status).toBe('anonymous');
  });

  it('follows logouts and logins in other tabs', async () => {
    const { session, refresh } = setup();
    const stop = session.watchOtherTabs(window);
    session.login({ token: token(), refresh_token: 'refresh-1' });

    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: REFRESH_TOKEN_KEY, newValue: null }));
    expect(session.store.getState()).toMatchObject({
      status: 'anonymous',
      lastLogoutReason: 'other-tab',
    });

    window.localStorage.setItem(REFRESH_TOKEN_KEY, 'from-other-tab');
    window.dispatchEvent(
      new StorageEvent('storage', { key: REFRESH_TOKEN_KEY, newValue: 'from-other-tab' }),
    );
    await vi.waitFor(() => expect(session.store.getState().status).toBe('authenticated'));
    expect(refresh).toHaveBeenCalledWith('from-other-tab');
    stop();
  });
});
