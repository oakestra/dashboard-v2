import { test as base, expect, type Page } from '@playwright/test';

import { mockAddonsManagerUrl, mockApiUrl } from '../env.ts';

export interface MockAddonPatch {
  enabled?: boolean;
  version?: string;
  sdk?: string;
}

/** Control API of tools/mock-addons-manager, standing in for installing/disabling via the addons engine. */
export const addonsManager = {
  async set(name: string, patch: MockAddonPatch): Promise<void> {
    const response = await fetch(`${mockAddonsManagerUrl}/__test/addons/${name}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    expect(response.ok).toBe(true);
  },
  async remove(name: string): Promise<void> {
    await fetch(`${mockAddonsManagerUrl}/__test/addons/${name}`, { method: 'DELETE' });
  },
  /** How long installs (and updates, approvals) and removals stay in their transitional status. */
  async setDelays(delays: {
    installDelayMs: number;
    disableDelayMs: number;
    /** How long after `active` the monitor notices a crashed container (flaky, broken). */
    monitorDelayMs?: number;
  }): Promise<void> {
    const response = await fetch(`${mockAddonsManagerUrl}/__test/config`, {
      method: 'PUT',
      body: JSON.stringify(delays),
    });
    expect(response.ok).toBe(true);
  },
  async reset(): Promise<void> {
    const response = await fetch(`${mockAddonsManagerUrl}/__test/reset`, { method: 'POST' });
    expect(response.ok).toBe(true);
  },
};

/** tools/mock-system-manager: fixture users log in with their username as password. */
export const mockApi = {
  async reset(): Promise<void> {
    const response = await fetch(`${mockApiUrl}/__test/reset`, { method: 'POST' });
    expect(response.ok).toBe(true);
  },
  async refreshTokenFor(username: string): Promise<string> {
    const response = await fetch(`${mockApiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: username }),
    });
    expect(response.ok).toBe(true);
    return ((await response.json()) as { refresh_token: string }).refresh_token;
  },
};

/** Must match REFRESH_TOKEN_KEY in apps/shell/src/core/auth/session.ts. */
const REFRESH_TOKEN_KEY = 'oakestra.auth.refresh-token';

/**
 * Plants a marker on `window`. If it is still there later, the page was not reloaded in between,
 * which is how the tests prove that addons appear and disappear live.
 */
export async function markPage(page: Page): Promise<() => Promise<boolean>> {
  await page.evaluate(() => {
    (window as unknown as { __e2eMarker?: number }).__e2eMarker = 42;
  });
  return () =>
    page.evaluate(() => (window as unknown as { __e2eMarker?: number }).__e2eMarker === 42);
}

export const test = base.extend<{
  /** Fixture user the page starts logged in as, or null for a logged-out page. */
  loggedInAs: string | null;
  resetBackends: void;
}>({
  loggedInAs: ['Admin', { option: true }],
  resetBackends: [
    // Playwright requires the fixture argument to be destructured, even when nothing is used.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await Promise.all([addonsManager.reset(), mockApi.reset()]);
      await use();
      await Promise.all([addonsManager.reset(), mockApi.reset()]);
    },
    { auto: true },
  ],
  // `provide` rather than Playwright's usual `use`, which the React hooks lint rule mistakes for
  // React's use() inside a function called "page".
  page: async ({ page, loggedInAs, resetBackends: _ }, provide) => {
    if (loggedInAs) {
      // Seeds the refresh token the way a previous login would have left it; the shell restores
      // the session from it. Only once per tab, so a logout in the test sticks across reloads.
      const token = await mockApi.refreshTokenFor(loggedInAs);
      await page.addInitScript(
        ([key, value]) => {
          if (window.sessionStorage.getItem('e2e-session-seeded')) return;
          window.sessionStorage.setItem('e2e-session-seeded', '1');
          window.localStorage.setItem(key, value);
        },
        [REFRESH_TOKEN_KEY, token] as const,
      );
    }
    await provide(page);
  },
});

/**
 * Serves config.json with a `/ui-addons` poll interval that never fires during a test. Without
 * it the compose stack's 1s interval would pick up a status change on its own and hide a missing
 * explicit refresh after an install or a disable.
 */
export async function withoutUiAddonsPolling(page: Page): Promise<void> {
  await page.route('**/config.json', async (route) => {
    const response = await route.fetch();
    const config = (await response.json()) as Record<string, unknown>;
    await route.fulfill({ response, json: { ...config, addonsPollIntervalMs: 3_600_000 } });
  });
}

export { expect };
