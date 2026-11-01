import { createOakestraApi, createOakestraClient } from '@oakestra/api';
import type { OakestraApi } from '@oakestra/dashboard-sdk';

import { createAddonsAdminApi, type AddonsAdminApi } from '../addons/addons-admin';
import { createAuthSession, type AuthSession } from '../auth/session';
import { createAuthorizedFetch, type Fetch } from './authorized-fetch';

export interface ApiServices {
  api: OakestraApi;
  auth: AuthSession;
  addonsAdmin: AddonsAdminApi;
}

export interface ApiServicesOptions {
  apiUrl: string;
  /** Defaults match the config defaults (`/addons-api`, `/marketplace-api`). */
  addonsManagerUrl?: string;
  marketplaceUrl?: string;
  storage: Storage;
  /** Defaults to the global fetch, looked up per request (MSW and test spies replace it). */
  send?: Fetch;
}

/**
 * Wires the auth session and the API client together. The session refreshes through a client
 * without the auth wrapper, otherwise a refresh would try to authorize itself.
 */
export function createApiServices(options: ApiServicesOptions): ApiServices {
  const baseUrl = options.apiUrl.replace(/\/+$/, '');
  const send = options.send ?? ((request: Request) => globalThis.fetch(request));

  const publicApi = createOakestraApi(createOakestraClient({ baseUrl, fetch: send }));
  const auth = createAuthSession({
    storage: options.storage,
    refresh: (refreshToken) => publicApi.auth.refresh(refreshToken),
  });

  const authorizedFetch = createAuthorizedFetch(auth, send);
  const endpoints = createOakestraApi(createOakestraClient({ baseUrl, fetch: authorizedFetch }));
  const api: OakestraApi = {
    ...endpoints,
    baseUrl,
    fetch: (path, init) =>
      authorizedFetch(new Request(`${baseUrl}/${path.replace(/^\/+/, '')}`, init)),
  };
  // Same authorized fetch as the main API: the addon backends do not check the token yet, but
  // will once they verify the Oakestra JWT.
  const addonsAdmin = createAddonsAdminApi({
    addonsManagerUrl: options.addonsManagerUrl ?? '/addons-api',
    marketplaceUrl: options.marketplaceUrl ?? '/marketplace-api',
    send: authorizedFetch,
  });
  return { api, auth, addonsAdmin };
}
