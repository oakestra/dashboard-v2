import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CoreModule } from '../../core/modules';
import { renderApp } from '../../test/render';

const modules: CoreModule[] = [
  {
    id: 'demo',
    label: 'Demo',
    routes: [
      { path: 'infra', element: <h1>Infrastructure</h1>, handle: { crumb: 'Infrastructure' } },
    ],
    contributions: {
      'nav.items': [
        { id: 'apps', label: 'Applications', path: '/apps', group: 'main' },
        {
          id: 'infra',
          label: 'Infrastructure',
          path: '/infra',
          group: 'management',
          roles: ['Admin', 'Infrastructure_Provider'],
        },
      ],
    },
  },
];

describe('<AppLayout>', () => {
  it('filters nav items by role', async () => {
    renderApp({ modules, route: '/infra', user: { username: 'alice' } });
    expect(await screen.findByTestId('nav-demo-apps')).toBeVisible();
    expect(screen.queryByTestId('nav-demo-infra')).not.toBeInTheDocument();
  });

  it('honours role overrides of the mock session', async () => {
    renderApp({
      modules,
      route: '/infra',
      user: { username: 'alice', roles: ['Infrastructure_Provider'] },
    });
    expect(await screen.findByTestId('nav-demo-infra')).toBeVisible();
    expect(screen.getByText('Management')).toBeVisible();
  });

  it('shows breadcrumbs, the user menu and configured external links', async () => {
    renderApp({
      modules,
      route: '/infra',
      config: { grafanaUrl: 'https://grafana.example' },
    });

    expect(await screen.findByTestId('breadcrumbs')).toHaveTextContent('HomeInfrastructure');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByTestId('user-menu')).toHaveTextContent('Admin');
    expect(screen.getByTestId('nav-external-grafana')).toHaveAttribute(
      'href',
      'https://grafana.example',
    );
    // Root organization: no badge.
    expect(screen.queryByTestId('organization-badge')).not.toBeInTheDocument();
  });
});
