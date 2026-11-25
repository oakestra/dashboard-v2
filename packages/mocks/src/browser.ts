import { http, HttpResponse, type RequestHandler } from 'msw';
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
 * `serviceWorkerUrl` (default `/mockServiceWorker.js`; the shell's Vite config does that in `mock`
 * mode and emits it in `demo` builds).
 */
export async function startMockWorker(
  options: Omit<MockApiOptions, 'store'> &
    Partial<Pick<MockApiOptions, 'store'>> & {
      /** Handlers for other services, checked before the system-manager ones. */
      extraHandlers?: readonly RequestHandler[];
      /**
       * Also serve the addons-manager and marketplace-manager (absolute URLs). With `uiAddonsUrl`
       * the backend also answers `/ui-addons`, so installing an addon with a UI loads it.
       */
      addons?: AddonsBackendOptions & {
        managerUrl: string;
        marketplaceUrl: string;
        uiAddonsUrl?: string;
      };
      /** Where the worker script is served; a site below a subpath needs it there. */
      serviceWorkerUrl?: string;
    },
): Promise<AddonsBackend> {
  const { extraHandlers = [], addons: addonOptions, serviceWorkerUrl, ...apiOptions } = options;
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
  const uiAddonsHandlers = addonOptions?.uiAddonsUrl
    ? [http.get(addonOptions.uiAddonsUrl, () => HttpResponse.json(addons.uiAddons()))]
    : [];
  const worker = setupWorker(
    ...extraHandlers,
    ...uiAddonsHandlers,
    ...addonHandlers,
    ...createHandlers({ ...apiOptions, store }),
  );
  // Everything else (config.json, Vite modules, addon remotes) goes to the network as usual.
  await worker.start({
    onUnhandledFrame: 'bypass',
    quiet: true,
    // The default scope is the script's directory, the site root even below a subpath.
    ...(serviceWorkerUrl ? { serviceWorker: { url: serviceWorkerUrl } } : {}),
  });
  return addons;
}
