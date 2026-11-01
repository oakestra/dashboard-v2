import { createMockSession, http, HttpResponse } from '@oakestra/mocks';
import { describe, expect, it, vi } from 'vitest';

import { mockServer, mockStore, TEST_API_URL } from '../../test/msw';
import { createApiServices } from './create-api';

function services() {
  return createApiServices({ apiUrl: TEST_API_URL, storage: window.localStorage });
}

function login(auth: ReturnType<typeof services>['auth'], ttlSeconds = 600) {
  const session = createMockSession(mockStore, { accessTokenTtlSeconds: ttlSeconds });
  auth.login({ token: session.accessToken, refresh_token: session.refreshToken });
}

describe('authorized API client', () => {
  it('sends the bearer token', async () => {
    const { api, auth } = services();
    login(auth);
    await expect(api.users.get('Admin')).resolves.toMatchObject({ name: 'Admin' });
  });

  it('refreshes an access token that is about to expire before sending', async () => {
    const { api, auth } = services();
    login(auth, 10);
    const refreshes = vi.fn();
    mockServer.events.on('request:start', ({ request }) => {
      if (request.url.endsWith('/auth/refresh')) refreshes();
    });

    await Promise.all([api.users.get('Admin'), api.clusters.list(), api.users.getRoles('Admin')]);
    expect(refreshes).toHaveBeenCalledOnce();
    mockServer.events.removeAllListeners();
  });

  it('retries once after a 401, keeping the request body', async () => {
    const { api, auth } = services();
    login(auth);
    let first = true;
    const bodies: unknown[] = [];
    mockServer.use(
      http.post(`${TEST_API_URL}/organization/`, async ({ request }) => {
        bodies.push(await request.clone().json());
        if (first) {
          first = false;
          return HttpResponse.json({ msg: 'Token has expired' }, { status: 401 });
        }
        return undefined;
      }),
    );

    const org = await api.organizations.create({ name: 'retry', member: [] });
    expect(org.name).toBe('retry');
    expect(bodies).toEqual([
      { name: 'retry', member: [] },
      { name: 'retry', member: [] },
    ]);
  });

  it('logs out when the refresh token is rejected as well', async () => {
    const { api, auth } = services();
    login(auth);
    mockServer.use(
      http.get(`${TEST_API_URL}/user/:name`, () =>
        HttpResponse.json({ msg: 'Token has expired' }, { status: 401 }),
      ),
      http.post(`${TEST_API_URL}/auth/refresh`, () =>
        HttpResponse.json({ msg: 'Token has expired' }, { status: 401 }),
      ),
    );

    await expect(api.users.get('Admin')).rejects.toMatchObject({ status: 401 });
    expect(auth.store.getState()).toMatchObject({
      status: 'anonymous',
      lastLogoutReason: 'expired',
    });
  });

  it('gives the raw fetch the same treatment', async () => {
    const { api, auth } = services();
    login(auth);
    const response = await api.fetch('/permission/Admin');
    expect(await response.json()).toEqual({ roles: expect.arrayContaining(['Admin']) });
    expect(api.baseUrl).toBe(TEST_API_URL);
  });

  it('leaves requests alone when nobody is logged in', async () => {
    const { api } = services();
    await expect(api.users.get('Admin')).rejects.toMatchObject({
      status: 401,
      message: 'Missing Authorization Header',
    });
    await expect(api.clusters.list()).resolves.toHaveLength(2);
  });
});
