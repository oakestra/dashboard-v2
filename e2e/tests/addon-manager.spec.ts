import type { Page } from '@playwright/test';

import { addonsManager, expect, markPage, test, withoutUiAddonsPolling } from './fixtures.ts';

// compose.dev.yml starts the mock with INSTALL_DELAY_MS=500; `reset` keeps delays, so
// tests that change them put this back.
const COMPOSE_DELAY_MS = 500;
const COMPOSE_MONITOR_DELAY_MS = 4000;

// Delays the tests set, long enough for the intermediate badge to be on screen for a while.
const INSTALL_DELAY_MS = 2000;
const DISABLE_DELAY_MS = 3000;

// Intervals of the shell's installed list (INSTALLED_POLL_MS and INSTALLED_IDLE_POLL_MS in
// features/addon-manager/api/polling.ts). A status change is seen at the next poll, so every wait
// is the backend delay plus one poll plus slack for a slow CI runner.
const SHELL_FAST_POLL_MS = 2500;
const SHELL_IDLE_POLL_MS = 10_000;
const SLACK_MS = 5000;

const exampleNav = (page: Page) => page.getByTestId('nav-example-main');
const isUiAddonsRequest = (request: { url(): string }) =>
  new URL(request.url()).pathname === '/ui-addons';

/** Installs from the marketplace: the consent dialog, then accepting exactly that definition. */
async function installFromMarketplace(page: Page, name: string): Promise<void> {
  await page
    .getByTestId(`marketplace-card-${name}`)
    .getByRole('button', { name: `Install ${name}` })
    .click();
  const dialog = page.getByTestId('consent-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Accept and install' }).click();
}

test.describe('addon manager', () => {
  test.afterEach(async () => {
    await addonsManager.setDelays({
      installDelayMs: COMPOSE_DELAY_MS,
      disableDelayMs: COMPOSE_DELAY_MS,
      monitorDelayMs: COMPOSE_MONITOR_DELAY_MS,
    });
  });

  test('disabling and removing an addon takes its nav item away without a reload', async ({
    page,
  }) => {
    await addonsManager.setDelays({
      installDelayMs: COMPOSE_DELAY_MS,
      disableDelayMs: DISABLE_DELAY_MS,
    });
    // The /ui-addons poll would hide a missing refresh, so only an explicit one can update the nav.
    await withoutUiAddonsPolling(page);
    await page.goto('/addon-manager/installed');
    const row = page.getByTestId('installed-addon-example');
    await expect(row.getByText('Active')).toBeVisible();
    await expect(exampleNav(page)).toBeVisible();
    const notReloaded = await markPage(page);

    const refreshed = page.waitForRequest(isUiAddonsRequest);
    await row.getByRole('button', { name: 'More actions for example' }).click();
    await page.getByRole('menuitem', { name: 'Disable example' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Disable addon' }).click();

    // The nav item goes as soon as the addon leaves `active`, not when the disabling is done.
    await refreshed;
    await expect(row.getByText('Disabling')).toBeVisible();
    await expect(exampleNav(page)).toHaveCount(0);
    await expect(row.getByText('Disabled')).toBeVisible({
      timeout: DISABLE_DELAY_MS + SHELL_FAST_POLL_MS + SLACK_MS,
    });

    await page.getByRole('button', { name: 'Remove example' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove addon' }).click();
    await expect(page.getByTestId('installed-addon-example')).toHaveCount(0);
    expect(await notReloaded()).toBe(true);
  });

  test('installing from the marketplace brings the addon UI back without a reload', async ({
    page,
  }) => {
    await addonsManager.remove('example');
    await addonsManager.setDelays({
      installDelayMs: INSTALL_DELAY_MS,
      disableDelayMs: COMPOSE_DELAY_MS,
    });
    await withoutUiAddonsPolling(page);
    await page.goto('/addon-manager/marketplace');
    const card = page.getByTestId('marketplace-card-example');
    await expect(card.getByRole('button', { name: 'Install example' })).toBeEnabled();
    await expect(exampleNav(page)).toHaveCount(0);
    const notReloaded = await markPage(page);

    // Nothing but the transition to `active` requests /ui-addons here: the poll is switched off
    // and installing the addon changes nothing the UI list shows.
    const refreshed = page.waitForRequest(isUiAddonsRequest, {
      timeout: INSTALL_DELAY_MS + SHELL_FAST_POLL_MS + SLACK_MS,
    });
    await card.getByRole('button', { name: 'Install example' }).click();
    const review = page.getByTestId('consent-dialog');
    await expect(review.getByTestId('permission-host_ports:9100')).toBeVisible();
    await review.getByRole('button', { name: 'Accept and install' }).click();

    await expect(page).toHaveURL(/\/addon-manager\/installed$/);
    const row = page.getByTestId('installed-addon-example');
    await expect(row.getByText('Installing')).toBeVisible();
    const activeTimeout = INSTALL_DELAY_MS + SHELL_FAST_POLL_MS + SLACK_MS;
    await expect(row.getByText('Active')).toBeVisible({ timeout: activeTimeout });
    await refreshed;
    await expect(row.getByText('Loaded')).toBeVisible({ timeout: SLACK_MS });
    await expect(exampleNav(page)).toBeVisible();

    await exampleNav(page).click();
    await expect(page).toHaveURL(/\/addons\/example$/);
    await expect(page.getByTestId('example-banner')).toBeVisible();
    expect(await notReloaded()).toBe(true);
  });

  test('shows a crash the monitor finds after the addon already looked active', async ({
    page,
  }) => {
    await addonsManager.setDelays({
      installDelayMs: COMPOSE_DELAY_MS,
      disableDelayMs: COMPOSE_DELAY_MS,
      monitorDelayMs: 5000,
    });
    await page.goto('/addon-manager/marketplace');
    await installFromMarketplace(page, 'broken-addon');

    const row = page.getByTestId('installed-addon-broken-addon');
    await expect(row.getByText('Active')).toBeVisible({
      timeout: COMPOSE_DELAY_MS + SHELL_FAST_POLL_MS + SLACK_MS,
    });
    // Nobody touches the page: the slow poll alone has to pick up the monitor's verdict.
    await expect(row.getByText('Failed')).toBeVisible({
      timeout: 5000 + SHELL_IDLE_POLL_MS + SLACK_MS,
    });
    await row.getByRole('button', { name: 'broken-addon', exact: true }).click();
    await expect(page.getByTestId('addon-logs')).toContainText('manifest');
  });

  test('shows an install-time failure without logs', async ({ page }) => {
    await page.goto('/addon-manager/marketplace');
    await installFromMarketplace(page, 'install-error-addon');

    const row = page.getByTestId('installed-addon-install-error-addon');
    await expect(row.getByText('Failed')).toBeVisible({
      timeout: COMPOSE_DELAY_MS + SHELL_FAST_POLL_MS + SLACK_MS,
    });
    await row.getByRole('button', { name: 'install-error-addon', exact: true }).click();
    await expect(page.getByTestId('addon-detail')).toBeVisible();
    await expect(page.getByTestId('addon-logs')).toHaveCount(0);
    await expect(page.getByTestId('failed-services')).toHaveCount(0);
    await expect(page.getByTestId('status-message')).toContainText('exit status');
  });

  test('approves a failed addon again, which is deployed again', async ({ page }) => {
    await page.goto('/addon-manager/installed');
    const row = page.getByTestId('installed-addon-legacy-exporter');
    // The engine's reason is the hint of the state button that offers the fix.
    await expect(row.getByText('Failed')).toBeVisible();
    await expect(page.getByTestId('addon-state-legacy-exporter-hint')).toContainText(
      'grant signature invalid',
    );

    await row.getByRole('button', { name: 'Approve legacy-exporter again' }).click();
    const review = page.getByTestId('consent-dialog');
    await expect(review.getByTestId('permission-host_paths:/var/log:ro')).toBeVisible();
    await review.getByRole('button', { name: 'Accept and approve' }).click();

    await expect(row.getByText('Active')).toBeVisible({
      timeout: COMPOSE_DELAY_MS + SHELL_FAST_POLL_MS + SLACK_MS,
    });
  });

  test('updates an addon after accepting the new version', async ({ page }) => {
    await page.goto('/addon-manager/installed');
    const row = page.getByTestId('installed-addon-analytics');
    // Partially active outranks the update on the state button, so it is in the row menu.
    await row.getByRole('button', { name: 'More actions for analytics' }).click();
    await page.getByRole('menuitem', { name: 'Update analytics to 1.2.0' }).click();

    const review = page.getByTestId('consent-dialog');
    await expect(review.getByTestId('consent-version')).toContainText('1.1.0 to 1.2.0');
    await expect(review.getByTestId('permission-host_ports:9090')).toContainText('New');
    await review.getByRole('button', { name: 'Accept and update' }).click();

    await expect(row.getByText('v1.2.0')).toBeVisible();
    await expect(row.getByText('Active')).toBeVisible({
      timeout: COMPOSE_DELAY_MS + SHELL_FAST_POLL_MS + SLACK_MS,
    });
  });

  test('a registered addon appears in the marketplace at once, without a reload', async ({
    page,
  }) => {
    await page.goto('/addon-manager/marketplace');
    await expect(page.getByTestId('marketplace-card-example')).toBeVisible();
    const notReloaded = await markPage(page);

    await page.getByRole('button', { name: 'Register addon' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Definition (JSON)').fill(
      JSON.stringify({
        name: 'e2e-registered',
        version: '1.0.0',
        services: [{ service_name: 'main', image: 'ghcr.io/oakestra/e2e-registered:1' }],
      }),
    );
    await dialog.getByRole('button', { name: 'Register' }).click();
    await expect(page.getByText('Registered local/e2e-registered 1.0.0')).toBeVisible();
    await expect(page.getByTestId('marketplace-card-local/e2e-registered')).toBeVisible();
    expect(await notReloaded()).toBe(true);
  });

  test('adds a tap and lists it with its sync state', async ({ page }) => {
    await page.goto('/addon-manager/sources');
    await expect(page.getByTestId('source-sync-lab-hint')).toContainText('404');

    await page.getByRole('button', { name: 'Add tap' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('e2e-tap');
    await dialog.getByLabel('Index URL').fill('https://e2e.example/index.json');
    await dialog.getByRole('button', { name: 'Add tap' }).click();

    await expect(page.getByTestId('source-e2e-tap')).toBeVisible();
    await page
      .getByTestId('source-e2e-tap')
      .getByRole('button', { name: 'More actions for e2e-tap' })
      .click();
    await page.getByRole('menuitem', { name: 'Delete tap' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete tap' }).click();
    await expect(page.getByTestId('source-e2e-tap')).toHaveCount(0);
  });
});

test.describe('addon manager as a non-admin', () => {
  test.use({ loggedInAs: 'alice' });

  test('is refused', async ({ page }) => {
    await page.goto('/addon-manager/installed');
    await expect(page.getByText('Access denied')).toBeVisible();
    await expect(page.getByTestId('nav-addon-manager-addon-manager')).toHaveCount(0);
  });
});
