import {
  createAddonsClient,
  createAddonsManagerApi,
  createMarketplaceApi,
  type AddonsManagerEndpoints,
  type MarketplaceEndpoints,
} from '@oakestra/api';
import type { QueryClient } from '@tanstack/react-query';
import { createContext, useContext } from 'react';

import type { Fetch } from '../api/authorized-fetch';
import { uiAddonsQueryKey } from './ui-addons';

/**
 * The APIs behind the addon management pages. Shell-internal: addons do not get them, and they
 * are deliberately not part of the SDK's `OakestraApi`. The UI that uses them is Admin-only, but
 * that is a convenience, not a security boundary, until the backends verify the Oakestra JWT.
 */
export interface AddonsAdminApi {
  /** Installed addons (`addonsManagerUrl`). */
  manager: AddonsManagerEndpoints;
  /** Addon definitions that can be installed (`marketplaceUrl`). */
  marketplace: MarketplaceEndpoints;
}

export interface AddonsAdminApiOptions {
  addonsManagerUrl: string;
  marketplaceUrl: string;
  /** The authorized fetch, so the bearer token is sent. */
  send: Fetch;
}

export function createAddonsAdminApi(options: AddonsAdminApiOptions): AddonsAdminApi {
  return {
    manager: createAddonsManagerApi(
      createAddonsClient({ baseUrl: options.addonsManagerUrl, fetch: options.send }),
    ),
    marketplace: createMarketplaceApi(
      createAddonsClient({ baseUrl: options.marketplaceUrl, fetch: options.send }),
    ),
  };
}

export const AddonsAdminApiContext = createContext<AddonsAdminApi | null>(null);

/** Components get the addon management APIs here; route loaders via `appRouterContext.addonsAdmin`. */
export function useAddonsAdminApi(): AddonsAdminApi {
  const api = useContext(AddonsAdminApiContext);
  if (!api) {
    throw new Error('useAddonsAdminApi() must be used below <AddonsAdminApiContext.Provider>');
  }
  return api;
}

/**
 * Refetches `/ui-addons` now instead of at the next poll. Call it after an install reached
 * `active` or an addon was disabled, so its UI appears or disappears at once.
 */
export function refreshUiAddons(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: uiAddonsQueryKey });
}
