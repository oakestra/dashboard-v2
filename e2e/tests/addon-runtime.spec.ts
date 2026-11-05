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
    // The light theme's --primary-fill in packages/ui/src/styles/styles.css.
    await expect(button).toHaveCSS('background-color', 'oklch(0.455 0.07 225)');
  });

  test('addon utilities are prefixed and cannot override shell classes', async ({ page }) => {
    await page.goto('/addons/example');
    await expect(page.getByTestId('example-banner')).toBeVisible();

    // The addon stylesheet loads after the shell's in the same layer. An unprefixed utility in it
    // (say `.hidden`) would beat the shell's responsive classes, so every class selector it
    // contains must carry the addon prefix.
    const unprefixed = await page.evaluate(() => {
      const selectors: string[] = [];
      const collect = (rules: CSSRuleList) => {
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule) selectors.push(rule.selectorText);
          if ('cssRules' in rule) collect((rule as CSSGroupingRule).cssRules);
        }
      };
      for (const sheet of document.styleSheets) {
        if (sheet.href?.includes('/addon-assets/example/')) collect(sheet.cssRules);
      }
      if (selectors.length === 0) return 'no stylesheet from /addon-assets/example/ found';
      // Any class selector not starting with the prefix counts, including `.dark\:hidden`, `.-mt-2`
      // and `.\[mask-type\:alpha\]`. Only the bare `.dark` is allowed: it is the shell's theme
      // class that the `dark:` variant refers to.
      const unprefixedClass = /(^|[^\w\\-])\.(?!ex\\:)(?!dark(?![\w\\-]))/;
      return selectors.filter((selector) => unprefixedClass.test(selector));
    });
    expect(unprefixed).toEqual([]);

    await expect(page.getByTestId('nav-overview-overview')).toBeVisible();
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

  test('nav sub-items of an addon lead to its pages', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByTestId('nav-toggle-example-main');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await page.getByTestId('nav-example-main').click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('nav-example-main-overview')).toHaveAttribute(
      'aria-current',
      'page',
    );

    const about = page.getByTestId('nav-example-main-about');
    await expect(about).toHaveAttribute('href', '/addons/example/about');
    await about.click();
    await expect(page.getByTestId('example-about')).toBeVisible();
    await expect(about).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('nav-example-main')).not.toHaveAttribute('aria-current');

    // The addon's settings live on its own page, not on the shell's Settings page.
    await page.getByTestId('nav-example-main-settings').click();
    await expect(page.getByTestId('example-settings')).toBeVisible();
  });

  test('breadcrumbs show the addon label and the crumbs of its routes', async ({ page }) => {
    await page.goto('/addons/example/about');
    await expect(page.getByTestId('example-about')).toBeVisible();
    const breadcrumbs = page.getByTestId('breadcrumbs');
    await expect(breadcrumbs).toHaveText('HomeExampleAbout');

    await breadcrumbs.getByRole('link', { name: 'Example' }).click();
    await expect(page).toHaveURL(/\/addons\/example$/);
    await expect(page.getByTestId('example-banner')).toBeVisible();
    await expect(breadcrumbs).toHaveText('HomeExample');

    await page.getByRole('link', { name: 'Open a nested page' }).click();
    await expect(page.getByTestId('example-details')).toHaveText('Item 42');
    await expect(breadcrumbs).toHaveText('HomeExampleDetails');
  });

  test.describe('as a user without the Admin role', () => {
    test.use({ loggedInAs: 'alice' });

    test('the role-restricted settings route shows the shell 403 page', async ({ page }) => {
      await page.goto('/addons/example/settings');
      await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
      await expect(page.getByTestId('example-settings')).toHaveCount(0);
      // Only the page is replaced: the addon's nav entry and the breadcrumbs stay.
      await expect(page.getByTestId('nav-example-main')).toBeVisible();
      await expect(page.getByTestId('nav-example-main-settings')).toHaveCount(0);
      await expect(page.getByTestId('breadcrumbs')).toHaveText('HomeExampleSettings');
    });
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
