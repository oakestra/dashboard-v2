import { http, HttpResponse, MOCK_USERS } from '@oakestra/mocks';
import { startMockWorker } from '@oakestra/mocks/browser';

import type { AppConfig } from './core/config/config';

/**
 * Dev-only (`pnpm dev:mock`): serves the system-manager API from MSW so the shell runs without
 * any backend. Fixture users log in with their username as password.
 */
export async function startMockApi(config: AppConfig): Promise<void> {
  await startMockWorker({
    baseUrl: new URL(config.apiUrl, window.location.origin).href,
    delayMs: 300,
    instanceStartupMs: 5000,
    // The addons-manager and marketplace are mocked too (installs settle after 3s). No addon UI
    // container exists in mock mode though, so /ui-addons stays empty and keeps the poll quiet;
    // the dev override (?addon-override=...) still loads addons from a local dev server.
    addons: {
      managerUrl: new URL(config.addonsManagerUrl, window.location.origin).href,
      marketplaceUrl: new URL(config.marketplaceUrl, window.location.origin).href,
      installDelayMs: 3000,
    },
    extraHandlers: [http.get(config.uiAddonsUrl, () => HttpResponse.json([]))],
  });
  console.info(
    `[mock api] system-manager mocked at ${config.apiUrl}, addons-manager at ${config.addonsManagerUrl}, marketplace at ${config.marketplaceUrl}. Log in as one of ${MOCK_USERS.join(', ')} ` +
      '(password = username).',
  );
}
