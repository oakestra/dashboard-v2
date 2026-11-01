import type { Page } from '@playwright/test';

import { addonsManager, expect, test } from './fixtures.ts';

function allCss(page: Page): Promise<string> {
  return page.evaluate(() =>
    [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
      .join('\n'),
  );
}

interface Probe {
  useState: unknown;
  queryClient: unknown;
  useHostContext: unknown;
  user: unknown;
}

test.describe('addon runtime', () => {
  test('the addon uses the shell instances of React, QueryClient, SDK and auth', async ({
    page,
  }) => {
    await page.goto('/addons/example');
    await expect(page.getByTestId('example-greeting')).toHaveText('Hello Admin');

    const identity = await page.evaluate(() => {
      const debug = (
        window as unknown as { __OAK_DEBUG__?: { host: Probe; addons: Record<string, Probe> } }
      ).__OAK_DEBUG__;
      if (!debug) return 'no debug hook: build the shell with VITE_OAK_DEBUG=true';
      const host = debug.host;
      const addon = debug.addons.example;
      if (!addon) return 'the example addon did not report its singletons';
      return {
        react: addon.useState === host.useState,
        queryClient: addon.queryClient === host.queryClient,
        sdk: addon.useHostContext === host.useHostContext,
        user: addon.user === host.user,
      };
    });

    expect(identity).toEqual({ react: true, queryClient: true, sdk: true, user: true });
  });

  test('addon CSS is loaded together with the remote module', async ({ page }) => {
    await addonsManager.set('example', { enabled: false });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByTestId('example-hello-widget')).toHaveCount(0);
    // The shell never generates fuchsia utilities, so they can only arrive with the addon.
    expect(await allCss(page)).not.toContain('fuchsia');

    await addonsManager.set('example', { enabled: true });
    await page.getByTestId('nav-example-main').click();
    const banner = page.getByTestId('example-banner');
    await expect(banner).toBeVisible();

    const style = await banner.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        borderLeftWidth: computed.borderLeftWidth,
        borderLeftColor: computed.borderLeftColor,
        backgroundColor: computed.backgroundColor,
      };
    });
    expect(await allCss(page)).toContain('fuchsia');
    expect(style).toEqual({
      borderLeftWidth: '4px',
      borderLeftColor: 'oklch(0.591 0.293 322.896)',
      backgroundColor: 'oklch(0.977 0.017 320.058)',
    });

    // Shell components used inside the addon keep the shared theme tokens.
    const button = page.getByRole('button', { name: 'Notify' });
    // The light theme's --primary in packages/ui/src/styles/styles.css.
    await expect(button).toHaveCSS('background-color', 'oklch(0.49 0.064 230)');
  });

  test('a contribution that throws only breaks its own slot', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('oakestra.example.throw', '1'));
    await page.goto('/');

    const error = page.getByTestId('contribution-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Crash test from addon "example" failed to render.');
    await expect(error).toHaveAttribute('data-source', 'addon:example');
    // Sibling contributions from the same addon, the nav and the page itself keep working.
    await expect(page.getByTestId('example-hello-widget')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await page.getByTestId('nav-example-main').click();
    await expect(page.getByTestId('example-banner')).toBeVisible();
  });

  test('a hard refresh on a nested addon route is served by the shell', async ({ page }) => {
    const response = await page.goto('/addons/example/details/42');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('text/html');
    await expect(page.getByTestId('example-details')).toHaveText('Item 42');

    await page.reload();
    await expect(page.getByTestId('example-details')).toHaveText('Item 42');

    await page.getByRole('link', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/addons\/example$/);
    await expect(page.getByTestId('example-banner')).toBeVisible();
  });

  test('the dev-only addon override is ignored by production builds', async ({ page }) => {
    const remoteRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/mf-manifest.json')) {
        remoteRequests.push(request.url());
      }
    });

    await page.goto('/addons/example?addon-override=example=http://127.0.0.1:9/mf-manifest.json');

    await expect(page.getByTestId('example-banner')).toBeVisible();
    expect(remoteRequests.length).toBeGreaterThan(0);
    expect(remoteRequests.every((url) => url.includes('/addon-assets/example/'))).toBe(true);
    expect(
      await page.evaluate(() => window.localStorage.getItem('oakestra.addon-overrides')),
    ).toBeNull();
  });
});
