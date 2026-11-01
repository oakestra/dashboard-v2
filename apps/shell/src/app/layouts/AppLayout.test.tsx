import { screen, within } from '@testing-library/react';
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
        { id: 'support', label: 'Support', path: '/support', group: 'footer' },
      ],
    },
  },
];

const nestedModules: CoreModule[] = [
  {
    id: 'tools',
    label: 'Tools',
    routes: [
      { path: 'tools', element: <h1>Tools</h1> },
      { path: 'tools/logs', element: <h1>Logs</h1> },
      { path: 'tools/audit', element: <h1>Audit</h1> },
      { path: 'other', element: <h1>Other</h1> },
    ],
    contributions: {
      'nav.items': [
        {
          id: 'tools',
          label: 'Tools',
          path: '/tools',
          group: 'main',
          children: [
            { id: 'overview', label: 'Overview', path: '/tools' },
            { id: 'logs', label: 'Logs', path: '/tools/logs' },
            { id: 'audit', label: 'Audit', path: '/tools/audit', roles: ['Admin'] },
          ],
        },
        { id: 'other', label: 'Other', path: '/other', group: 'main' },
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

  it('pins footer items to the bottom of the sidebar, outside the labelled groups', async () => {
    renderApp({ modules, route: '/infra' });
    const support = await screen.findByTestId('nav-demo-support');
    expect(support.closest('[data-sidebar="footer"]')).not.toBeNull();
    expect(support.closest('[data-sidebar="content"]')).toBeNull();
    expect(screen.getByTestId('nav-demo-apps').closest('[data-sidebar="content"]')).not.toBeNull();
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

  describe('nested nav items', () => {
    it('expands the parent on one of its pages and marks only the sub-item as current', async () => {
      renderApp({ modules: nestedModules, route: '/tools/logs', user: { username: 'alice' } });

      const logs = await screen.findByTestId('nav-tools-tools-logs');
      expect(logs).toHaveAttribute('href', '/tools/logs');
      expect(logs).toHaveAttribute('aria-current', 'page');
      expect(screen.getByTestId('nav-tools-tools')).not.toHaveAttribute('aria-current');
      expect(screen.getByTestId('nav-tools-tools-overview')).not.toHaveAttribute('aria-current');
      expect(screen.getByTestId('nav-toggle-tools-tools')).toHaveAttribute('aria-expanded', 'true');
      // Sub-items are filtered by role like top-level items.
      expect(screen.queryByTestId('nav-tools-tools-audit')).not.toBeInTheDocument();
    });

    it('shows role-restricted sub-items to users holding the role', async () => {
      renderApp({ modules: nestedModules, route: '/tools', user: { username: 'Admin' } });
      expect(await screen.findByTestId('nav-tools-tools-audit')).toBeVisible();
      // On the parent's own path the "Overview" sub-item is the current page, not the parent.
      expect(screen.getByTestId('nav-tools-tools-overview')).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('stays collapsed elsewhere and opens when the route enters it', async () => {
      const { user } = renderApp({ modules: nestedModules, route: '/other' });

      const toggle = await screen.findByTestId('nav-toggle-tools-tools');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('nav-tools-tools-logs')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('nav-tools-tools'));
      expect(await screen.findByRole('heading', { name: 'Tools' })).toBeVisible();
      expect(toggle).toHaveAttribute('aria-expanded', 'true');

      await user.click(screen.getByTestId('nav-tools-tools-logs'));
      expect(await screen.findByRole('heading', { name: 'Logs' })).toBeVisible();
    });

    it('marks the parent as current when the user collapses it on a sub-page', async () => {
      const { user } = renderApp({ modules: nestedModules, route: '/tools/logs' });

      const toggle = await screen.findByTestId('nav-toggle-tools-tools');
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('nav-tools-tools-logs')).not.toBeInTheDocument();
      expect(screen.getByTestId('nav-tools-tools')).toHaveAttribute('aria-current', 'page');

      // Navigating within the entry does not reopen what the user closed.
      await user.click(screen.getByTestId('nav-tools-tools'));
      expect(await screen.findByRole('heading', { name: 'Tools' })).toBeVisible();
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('renders sub-items as a list inside the parent item', async () => {
      renderApp({ modules: nestedModules, route: '/tools' });
      const parent = (await screen.findByTestId('nav-tools-tools')).closest('li');
      expect(parent).not.toBeNull();
      const links = within(parent as HTMLElement).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual(['Tools', 'Overview', 'Logs', 'Audit']);
    });
  });
});
