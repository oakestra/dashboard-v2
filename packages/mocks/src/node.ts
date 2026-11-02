import { setupServer, type SetupServer } from 'msw/node';

import {
  createAddonsBackend,
  type AddonsBackend,
  type AddonsBackendOptions,
} from './addons-backend.ts';
import { createAddonsHandlers } from './addons-handlers.ts';
import { createHandlers, type MockApiOptions } from './handlers.ts';
import { createMockStore } from './store.ts';

export interface MockAddonsOptions extends AddonsBackendOptions {
  /** Absolute `addonsManagerUrl` the shell is configured with. */
  managerUrl: string;
  /** Absolute `marketplaceUrl` the shell is configured with. */
  marketplaceUrl: string;
}

export interface MockServer {
  server: SetupServer;
  store: MockApiOptions['store'];
  /** In-memory addons-manager and marketplace-manager. Call `addons.reset()` after each test. */
  addons: AddonsBackend;
}

/**
 * MSW for Node (Vitest). Call `server.listen()` in a setup file and `store.reset()` after each
 * test. Pass `addons` to also serve the addon management backends.
 */
export function createMockServer(
  options: Omit<MockApiOptions, 'store'> &
    Partial<Pick<MockApiOptions, 'store'>> & { addons?: MockAddonsOptions },
): MockServer {
  const { addons: addonOptions, ...apiOptions } = options;
  const store = apiOptions.store ?? createMockStore();
  const addons = createAddonsBackend(addonOptions);
  const handlers = [
    ...(addonOptions
      ? createAddonsHandlers({
          managerUrl: addonOptions.managerUrl,
          marketplaceUrl: addonOptions.marketplaceUrl,
          backend: addons,
        })
      : []),
    ...createHandlers({ ...apiOptions, store }),
  ];
  return { server: setupServer(...handlers), store, addons };
}
