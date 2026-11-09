import { HostContext, AddonContext, useAddonApi } from '@oakestra/dashboard-sdk';
import { createMockSession, http, HttpResponse } from '@oakestra/mocks';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, onTestFinished } from 'vitest';

import { addonSource } from '../addons/ui-addons';
import { createHostContextValue } from '../host/host-context';
import { mockServer, mockStore, TEST_API_URL } from '../../test/msw';
import { createApiServices } from './create-api';

const ORIGIN = window.location.origin;

function setup() {
  const { api, addonBackendFetch, auth } = createApiServices({
    apiUrl: TEST_API_URL,
    storage: window.localStorage,
  });
  const session = createMockSession(mockStore, { accessTokenTtlSeconds: 600 });
  auth.login({ token: session.accessToken, refresh_token: session.refreshToken });
  const host = createHostContextValue({
    user: null,
    api,
    addonBackendFetch,
    isFeatureEnabled: () => true,
    links: {},
  });
  const { addon } = addonSource({
    name: 'sla-gen',
    version: '1.0.0',
    basePath: '/addons/sla-gen',
    origin: 'manager',
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HostContext.Provider value={host}>
      <AddonContext.Provider value={addon}>{children}</AddonContext.Provider>
    </HostContext.Provider>
  );
  const addonApi = renderHook(() => useAddonApi(), { wrapper }).result.current;
  return { addonApi, host, auth, session };
}

/** Records every request MSW sees, so a test can tell that nothing was sent. */
function recordRequests() {
  const urls: string[] = [];
  const listener = ({ request }: { request: Request }) => void urls.push(request.url);
  mockServer.events.on('request:start', listener);
  onTestFinished(() => void mockServer.events.removeListener('request:start', listener));
  return urls;
}

describe('useAddonApi in the shell', () => {
  it('attaches the bearer token to addon backend requests', async () => {
    const { addonApi, session } = setup();
    let authorization: string | null = null;
    mockServer.use(
      http.get(`${ORIGIN}/addon-assets/sla-gen/api/runs`, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return HttpResponse.json([]);
      }),
    );
    await addonApi.fetch('/runs');
    expect(authorization).toBe(`Bearer ${session.accessToken}`);
  });

  it('returns a 401 from the addon backend as it is, without touching the session', async () => {
    const { addonApi, auth, session } = setup();
    let calls = 0;
    mockServer.use(
      http.post(`${ORIGIN}/addon-assets/sla-gen/api/runs`, () => {
        calls += 1;
        return HttpResponse.json({ msg: 'not allowed' }, { status: 401 });
      }),
    );
    const requests = recordRequests();
    const response = await addonApi.fetch('/runs', { method: 'POST', body: 'payload' });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ msg: 'not allowed' });
    expect(calls).toBe(1);
    expect(requests.some((url) => url.endsWith('/auth/refresh'))).toBe(false);
    await expect(auth.getAccessToken()).resolves.toBe(session.accessToken);
    expect(auth.store.getState().status).toBe('authenticated');
  });
});

describe('addonBackendFetch of the host context', () => {
  it.each([
    ['another origin', 'https://evil.example/addon-assets/sla-gen/api/x'],
    ['another path on the dashboard', `${ORIGIN}/addons-api/x`],
    ['the addon UI files', `${ORIGIN}/addon-assets/sla-gen/remoteEntry.js`],
    ['an encoded climb out of the backend', `${ORIGIN}/addon-assets/a/api/..%2f..%2f..%2fapi/x`],
    ['a name nginx would not route', `${ORIGIN}/addon-assets/Bad_Name/api/x`],
  ])('rejects %s without sending anything', async (_, url) => {
    const { host } = setup();
    const requests = recordRequests();
    await expect(host.addonBackendFetch(new Request(url))).rejects.toThrow(/refuses/);
    expect(requests).toEqual([]);
  });

  it('sends requests to any addon backend on the dashboard origin', async () => {
    const { host, session } = setup();
    let authorization: string | null = null;
    mockServer.use(
      http.get(`${ORIGIN}/addon-assets/other-addon/api/x`, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return HttpResponse.json({});
      }),
    );
    const response = await host.addonBackendFetch(
      new Request(`${ORIGIN}/addon-assets/other-addon/api/x`),
    );
    expect(response.status).toBe(200);
    expect(authorization).toBe(`Bearer ${session.accessToken}`);
  });
});
