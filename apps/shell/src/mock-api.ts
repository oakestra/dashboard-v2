import {
  createMockStore,
  http,
  HttpResponse,
  MOCK_USERS,
  withPlacementDemo,
  withShowcaseAddons,
} from '@oakestra/mocks';
import { startMockWorker } from '@oakestra/mocks/browser';

import { sitePath } from './core/base-path';
import type { AppConfig } from './core/config/config';

/**
 * `pnpm dev:mock` and the static demo: serves the system-manager API from MSW so the shell runs
 * without any backend. Fixture users log in with their username as password.
 */
export async function startMockApi(config: AppConfig): Promise<void> {
  const demo = import.meta.env.MODE === 'demo';
  const absolute = (url: string) => new URL(url, window.location.origin).href;
  await startMockWorker({
    baseUrl: absolute(config.apiUrl),
    // Several clusters (one silent), instances across them and services that cannot be placed.
    store: createMockStore(withPlacementDemo),
    delayMs: 300,
    instanceStartupMs: 5000,
    serviceWorkerUrl: sitePath('/mockServiceWorker.js'),
    // The addons-manager and marketplace are mocked too (installs settle after 3s).
    addons: {
      managerUrl: absolute(config.addonsManagerUrl),
      marketplaceUrl: absolute(config.marketplaceUrl),
      installDelayMs: 3000,
      // The demo serves real builds of its addons next to the shell, so /ui-addons lists the
      // installed ones and an install from the marketplace loads its UI. In dev:mock no addon
      // container exists, so /ui-addons stays empty and keeps the poll quiet; the dev override
      // (?addon-override=...) still loads addons from a local dev server.
      ...(demo
        ? { uiBlockSupport: true, customize: withShowcaseAddons, uiAddonsUrl: config.uiAddonsUrl }
        : {}),
    },
    extraHandlers: demo ? [] : [http.get(config.uiAddonsUrl, () => HttpResponse.json([]))],
  });
  console.info(
    `[mock api] system-manager mocked at ${config.apiUrl}, addons-manager at ${config.addonsManagerUrl}, marketplace at ${config.marketplaceUrl}. Log in as one of ${MOCK_USERS.join(', ')} ` +
      '(password = username).',
  );
}
