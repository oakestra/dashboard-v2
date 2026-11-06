import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderApp } from '../../test/render';
import { addonManagerModule } from '../addon-manager';
import { settingsModule } from './index';

describe('settings', () => {
  it('has no theme picker, the theme is a preference of the account', async () => {
    renderApp({ modules: [settingsModule], route: '/settings' });

    expect(await screen.findByText('No platform settings yet')).toBeVisible();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Settings');
    expect(screen.queryByRole('radio', { name: 'Dark' })).not.toBeInTheDocument();
  });

  it('redirects the old addon status page to the addon manager', async () => {
    const { router } = renderApp({
      modules: [settingsModule, addonManagerModule],
      route: '/settings/addons',
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Addons' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/addon-manager/installed');
  });

  it('keeps the old addon page on settings when the addon manager is disabled', async () => {
    const { router } = renderApp({
      modules: [settingsModule, addonManagerModule],
      route: '/settings/addons',
      preset: { modules: ['settings'], home: '/settings' },
    });

    expect(await screen.findByText('No platform settings yet')).toBeVisible();
    expect(router.state.location.pathname).toBe('/settings');
  });

  it('sends non-admins from the old addon page to the refusal', async () => {
    renderApp({
      modules: [settingsModule, addonManagerModule],
      route: '/settings/addons',
      user: { username: 'alice' },
    });

    expect(await screen.findByText('Access denied')).toBeVisible();
    // The error renders inside the layout, so the navigation stays usable.
    expect(screen.getByTestId('nav-settings-settings')).toBeVisible();
  });
});
