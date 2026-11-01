import { expect, test } from './fixtures.ts';

test.describe('authentication', () => {
  test.use({ loggedInAs: null });

  test('logs in, survives a reload and logs out again', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fprofile$/);

    await page.getByLabel('Username').fill('Admin');
    await page.getByLabel('Password').fill('Admin');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByTestId('account-username')).toHaveText('Admin');

    // The access token lives in memory only; the refresh token restores the session.
    await page.reload();
    await expect(page.getByTestId('account-username')).toHaveText('Admin');

    await page.getByTestId('user-menu').click();
    await page.getByTestId('logout').click();
    await expect(page).toHaveURL(/\/login$/);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  test('rejects wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('Admin');
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByTestId('login-error')).toHaveText('Invalid username or password.');
  });
});

test.describe('roles', () => {
  test('admins see the dashboard UI state of addons, also from the old settings URL', async ({
    page,
  }) => {
    await page.goto('/settings/addons');
    await expect(page).toHaveURL(/\/addon-manager\/installed$/);
    await expect(page.getByRole('row', { name: /example/ })).toContainText('Loaded');
  });

  test.describe('as an application provider', () => {
    test.use({ loggedInAs: 'alice' });

    test('the addon manager is refused', async ({ page }) => {
      await page.goto('/settings/addons');
      await expect(page.getByText('Access denied')).toBeVisible();
      await expect(page.getByTestId('nav-settings-settings')).toBeVisible();
    });

    test('Admin-only addon sub-items are hidden and their route is denied', async ({ page }) => {
      await page.goto('/addons/example/settings');
      await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
      await expect(page.getByTestId('nav-example-main-about')).toBeVisible();
      await expect(page.getByTestId('nav-example-main-settings')).toHaveCount(0);
    });
  });
});

test('logging out in one tab logs out the others', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByTestId('user-menu')).toBeVisible();
  const other = await context.newPage();
  await other.goto('/profile');
  await expect(other.getByTestId('account-username')).toHaveText('Admin');

  await page.getByTestId('user-menu').click();
  await page.getByTestId('logout').click();

  await expect(other).toHaveURL(/\/login/);
});
