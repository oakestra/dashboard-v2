import type { Page } from '@playwright/test';

import { expect, test } from './fixtures.ts';

// What the mock addons manager reports for the seeded example addon (packages/mocks).
const preset = {
  modules: ['overview', 'applications', 'users', 'organizations', 'profile', 'settings', 'help'],
  addonDiscovery: false,
  addons: [
    {
      name: 'example',
      version: '0.1.0',
      sdk: '^0.1.0',
      entry: '/addon-assets/example/mf-manifest.json',
      // The path of the dropped infrastructure module, which a preset addon may take over.
      mount: '/infrastructure',
    },
  ],
  nav: { items: { 'addon:applications:applications': { label: 'Workloads' } } },
};

/** Serves a preset the way an operator would mount one, without touching the compose stack. */
async function withPreset(page: Page): Promise<void> {
  await page.route('**/config.json', async (route) => {
    const response = await route.fetch();
    const config = (await response.json()) as Record<string, unknown>;
    await route.fulfill({ response, json: { ...config, presetUrl: '/preset.json' } });
  });
  await page.route('**/preset.json', (route) => route.fulfill({ json: preset }));
}

test.describe('deployment preset', () => {
  test('applies nav overrides, drops modules and mounts a preset addon', async ({ page }) => {
    const discoveryRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/ui-addons') discoveryRequests.push(request.url());
    });
    await withPreset(page);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

    const nav = page;
    await expect(nav.getByTestId('nav-applications-applications')).toHaveText(/Workloads/);
    await expect(nav.getByTestId('nav-infrastructure-infrastructure')).toHaveCount(0);
    // The addon's own item points at its mount, not at /addons/example.
    await expect(nav.getByTestId('nav-example-main')).toHaveAttribute('href', '/infrastructure');

    await page.goto('/infrastructure/about');
    await expect(page.getByTestId('breadcrumbs')).toContainText('Example');
    await expect(page.getByTestId('breadcrumbs')).toContainText('About');
    await expect(page).toHaveURL(/\/infrastructure\/about$/);

    await page.goto('/infrastructure');
    await expect(page.getByTestId('example-greeting')).toHaveText('Hello Admin');

    // The preset pins the addon to its mount, so the default URL forwards there.
    await page.goto('/addons/example');
    await expect(page).toHaveURL(/\/infrastructure$/);

    expect(discoveryRequests).toEqual([]);
  });
});
