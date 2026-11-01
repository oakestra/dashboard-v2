import { screen } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { renderApp } from '../../test/render';
import { addonManagerModule } from '../addon-manager';
import { settingsModule } from './index';

describe('settings', () => {
  it('has no theme picker of its own and explains the empty page', async () => {
    renderApp({ modules: [settingsModule], route: '/settings' });

    expect(await screen.findByText('No settings yet')).toBeVisible();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Settings');
  });

  it('renders settings panels contributed to the slot, filtered by role', async () => {
    const { services } = renderApp({
      modules: [settingsModule],
      route: '/settings',
      user: { username: 'alice' },
    });
    act(() =>
      services.contributions.getState().register(
        { kind: 'core', id: 'demo', label: 'demo' },
        {
          'settings.panels': [
            { id: 'everyone', title: 'For everyone', component: () => <p>visible</p> },
            {
              id: 'admins',
              title: 'Admins only',
              roles: ['Admin'],
              component: () => <p>secret</p>,
            },
          ],
        },
      ),
    );

    expect(await screen.findByText('For everyone')).toBeVisible();
    expect(screen.queryByText('Admins only')).not.toBeInTheDocument();
  });

  it('redirects the old addon status page to the addon manager', async () => {
    const { router } = renderApp({
      modules: [settingsModule, addonManagerModule],
      route: '/settings/addons',
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Addons' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/addon-manager/installed');
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
