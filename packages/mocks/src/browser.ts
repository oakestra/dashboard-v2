import type { RequestHandler } from 'msw';
import { setupWorker } from 'msw/browser';

import {
  createAddonsBackend,
  type AddonsBackend,
  type AddonsBackendOptions,
} from './addons-backend.ts';
import { createAddonsHandlers } from './addons-handlers.ts';
import { createHandlers, type MockApiOptions } from './handlers.ts';
import { createMockStore } from './store.ts';

/**
 * Starts MSW's service worker with the mock system-manager. The worker script must be served at
 * `/mockServiceWorker.js` (the shell's Vite config does that in `mock` mode).
 */
export async function startMockWorker(
  options: Omit<MockApiOptions, 'store'> &
    Partial<Pick<MockApiOptions, 'store'>> & {
      /** Handlers for other services, checked before the system-manager ones. */
      extraHandlers?: readonly RequestHandler[];
      /** Also serve the addons-manager and marketplace-manager (absolute URLs). */
      addons?: AddonsBackendOptions & { managerUrl: string; marketplaceUrl: string };
    },
): Promise<AddonsBackend> {
  const { extraHandlers = [], addons: addonOptions, ...apiOptions } = options;
  const store = apiOptions.store ?? createMockStore();
  const addons = createAddonsBackend(addonOptions);
  const addonHandlers = addonOptions
    ? createAddonsHandlers({
        managerUrl: addonOptions.managerUrl,
        marketplaceUrl: addonOptions.marketplaceUrl,
        backend: addons,
        delayMs: apiOptions.delayMs,
      })
    : [];
  const worker = setupWorker(
    ...extraHandlers,
    ...addonHandlers,
    ...createHandlers({ ...apiOptions, store }),
  );
  // Everything else (config.json, Vite modules, /ui-addons) goes to the network as usual.
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true });
  return addons;
}
