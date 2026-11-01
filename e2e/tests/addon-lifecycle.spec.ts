import type { Page } from '@playwright/test';

import { addonsManager, expect, markPage, test } from './fixtures.ts';

const exampleNav = (page: Page) => page.getByTestId('nav-example-main');

test.describe('addon lifecycle', () => {
  test('installing the addon adds its nav item, page and widgets without a reload', async ({
    page,
  }) => {
    await addonsManager.set('example', { enabled: false });
    await page.goto('/');
    await expect(page.getByText('No widgets installed.')).toBeVisible();
    await expect(exampleNav(page)).toHaveCount(0);
    const notReloaded = await markPage(page);

    await addonsManager.set('example', { enabled: true });

    await expect(exampleNav(page)).toBeVisible();
    await expect(page.getByTestId('example-hello-widget')).toBeVisible();
    await exampleNav(page).click();
    await expect(page).toHaveURL(/\/addons\/example$/);
    await expect(page.getByTestId('example-banner')).toBeVisible();
    expect(await notReloaded()).toBe(true);
  });

  test('disabling the addon removes its contributions and shows a disabled page', async ({
    page,
  }) => {
    await page.goto('/addons/example');
    await expect(page.getByTestId('example-banner')).toBeVisible();
    const notReloaded = await markPage(page);

    await addonsManager.set('example', { enabled: false });

    await expect(page.getByTestId('addon-disabled')).toBeVisible();
    await expect(exampleNav(page)).toHaveCount(0);
    await page.getByTestId('nav-overview-overview').click();
    await expect(page.getByTestId('example-hello-widget')).toHaveCount(0);
    expect(await notReloaded()).toBe(true);

    await addonsManager.set('example', { enabled: true });
    await expect(exampleNav(page)).toBeVisible();
    expect(await notReloaded()).toBe(true);
  });

  test('an upgrade asks for a reload instead of swapping the running addon', async ({ page }) => {
    await page.goto('/addons/example');
    await expect(page.getByTestId('example-banner')).toBeVisible();

    await addonsManager.set('example', { version: '0.2.0' });

    const toast = page.getByText('A new version of example is available');
    await expect(toast).toBeVisible();
    await expect(page.getByTestId('example-banner')).toBeVisible();

    await page.getByRole('button', { name: 'Reload' }).click();
    await expect(page.getByTestId('example-banner')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.__OAK_DEBUG__?.addonStates()))
      .toEqual({ example: 'loaded' });
    await expect(toast).toHaveCount(0);
  });

  test('an addon built for an incompatible SDK is not loaded', async ({ page }) => {
    await addonsManager.set('example', { sdk: '^9.0.0' });
    const manifestRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/addon-assets/example/')) manifestRequests.push(request.url());
    });

    await page.goto('/addons/example');

    await expect(page.getByTestId('addon-incompatible')).toContainText('^9.0.0');
    await expect(exampleNav(page)).toHaveCount(0);
    expect(manifestRequests).toEqual([]);
  });

  test('an addon whose UI is unreachable fails in isolation and is retried', async ({ page }) => {
    await addonsManager.set('ghost', { enabled: true });
    let attempts = 0;
    page.on('request', (request) => {
      if (request.url().includes('/addon-assets/ghost/mf-manifest.json')) attempts += 1;
    });

    await page.goto('/addons/ghost');

    await expect(page.getByTestId('addon-failed')).toBeVisible();
    await expect.poll(() => attempts, { timeout: 10_000 }).toBeGreaterThan(1);
    // The healthy addon is unaffected.
    await expect(exampleNav(page)).toBeVisible();
  });
});

declare global {
  interface Window {
    __OAK_DEBUG__?: { addonStates(): Record<string, string> };
  }
}
