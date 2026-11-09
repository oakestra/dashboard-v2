import { useAddonBasePath, type NavItem } from '@oakestra/dashboard-sdk';
import { useQuery } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { setEntry, type AddonRegistry } from '../../core/addons/addon-registry';
import type { CoreModule } from '../../core/modules';
import type { RouteHandle } from '../../core/router/route-handle';
import { renderApp } from '../../test/render';
import type { AppServices } from '../services';

const modules: CoreModule[] = [
  {
    id: 'demo',
    label: 'Demo',
    routes: [
      { path: 'infra', element: <h1>Infrastructure</h1>, handle: { crumb: 'Infrastructure' } },
      {
        path: 'map',
        element: <h1>Map</h1>,
        handle: { crumb: 'Map', fullWidth: true } satisfies RouteHandle,
      },
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

  it('applies the preset nav overrides and group labels', async () => {
    renderApp({
      modules,
      route: '/infra',
      preset: {
        modules: ['demo'],
        home: '/infra',
        nav: {
          groupLabels: { main: 'Workloads' },
          items: {
            'core:demo:apps': { label: 'Apps', group: 'management', order: 1 },
            'core:demo:support': { hidden: true },
          },
        },
      },
    });

    // Moved into "management" and renamed; the "main" group is empty, so its label is gone.
    expect(await screen.findByTestId('nav-demo-apps')).toHaveTextContent('Apps');
    expect(screen.queryByText('Workloads')).not.toBeInTheDocument();
    expect(screen.getByText('Management')).toBeVisible();
    expect(screen.queryByTestId('nav-demo-support')).not.toBeInTheDocument();
    const management = screen.getByText('Management').closest('[data-slot="sidebar-group"]')!;
    const links = within(management as HTMLElement).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Apps', 'Infrastructure']);
  });

  it('uses the preset label of a group that still has items', async () => {
    renderApp({
      modules,
      route: '/infra',
      preset: { modules: ['demo'], home: '/infra', nav: { groupLabels: { main: 'Workloads' } } },
    });
    expect(await screen.findByText('Workloads')).toBeVisible();
    expect(screen.queryByText('Platform')).not.toBeInTheDocument();
  });

  it('pins footer items to the bottom of the sidebar, outside the labelled groups', async () => {
    renderApp({ modules, route: '/infra' });
    const support = await screen.findByTestId('nav-demo-support');
    expect(support.closest('[data-sidebar="footer"]')).not.toBeNull();
    expect(support.closest('[data-sidebar="content"]')).toBeNull();
    expect(screen.getByTestId('nav-demo-apps').closest('[data-sidebar="content"]')).not.toBeNull();
  });

  it('opens a new page at the top and returns to the old offset on back', async () => {
    const { router } = renderApp({ modules, route: '/infra' });
    await screen.findByTestId('breadcrumbs');
    const panel = document.querySelector<HTMLElement>('[data-slot="sidebar-inset"]')!;

    panel.scrollTop = 300;
    panel.dispatchEvent(new Event('scroll'));
    await act(() => router.navigate('/infra?filter=a'));
    expect(panel.scrollTop).toBe(300);

    panel.dispatchEvent(new Event('scroll'));
    await act(() => router.navigate('/'));
    expect(panel.scrollTop).toBe(0);

    await act(() => router.navigate(-1));
    await waitFor(() => expect(panel.scrollTop).toBe(300));
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

  it('keeps pages in the centered column unless their route asks for the full width', async () => {
    const { router } = renderApp({ modules, route: '/infra' });
    expect(await screen.findByRole('heading', { name: 'Infrastructure' })).toBeVisible();
    expect(screen.getByTestId('page-content')).toHaveAttribute('data-width', 'default');
    expect(screen.getByTestId('page-content')).toHaveClass('max-w-7xl');

    await act(() => router.navigate('/map'));
    expect(await screen.findByRole('heading', { name: 'Map' })).toBeVisible();
    expect(screen.getByTestId('page-content')).toHaveAttribute('data-width', 'full');
    expect(screen.getByTestId('page-content')).not.toHaveClass('max-w-7xl');
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

  describe('nav badges', () => {
    const flopsSource = {
      kind: 'addon' as const,
      id: 'flops',
      label: 'addon "flops"',
      addon: { addonId: 'flops', version: '1.0.0', basePath: '/addons/flops' },
    };

    // Reads what an addon badge relies on: its own context and the shared query client.
    function QueuedJobs() {
      const basePath = useAddonBasePath();
      const jobs = useQuery({ queryKey: ['flops', 'queued'], queryFn: () => Promise.resolve(3) });
      return jobs.data ? <span title={basePath}>{jobs.data}</span> : null;
    }

    function register(services: AppServices, items: readonly NavItem[]) {
      act(() => services.contributions.getState().register(flopsSource, { 'nav.items': items }));
    }

    it('renders badges of items and sub-items inside the addon context', async () => {
      const { services } = renderApp({ modules, route: '/addons/flops/jobs' });
      register(services, [
        { id: 'alerts', label: 'Alerts', path: 'alerts', badge: () => <span>7</span> },
        {
          id: 'main',
          label: 'FLOps',
          path: '',
          badge: () => <span>!</span>,
          children: [
            { id: 'jobs', label: 'Jobs', path: 'jobs', badge: QueuedJobs },
            { id: 'quiet', label: 'Quiet', path: 'quiet', badge: () => null },
          ],
        },
      ]);

      expect(await screen.findByTestId('nav-badge-flops-alerts')).toHaveTextContent('7');
      expect(screen.getByTestId('nav-badge-flops-main')).toHaveTextContent('!');
      const jobs = await screen.findByTestId('nav-badge-flops-main-jobs');
      await waitFor(() => expect(jobs).toHaveTextContent('3'));
      expect(within(jobs).getByTitle('/addons/flops')).toBeInTheDocument();
      // jsdom ignores the `empty:hidden` class, so this only checks the box stays empty.
      expect(screen.getByTestId('nav-badge-flops-main-quiet')).toBeEmptyDOMElement();
      expect(screen.getByTestId('nav-flops-main-quiet')).toBeVisible();
    });

    it('hides a badge that throws and keeps the rest of the sidebar', async () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const Broken = () => {
        throw new Error('kaputt');
      };
      const { services } = renderApp({ modules, route: '/addons/flops/jobs' });
      register(services, [
        { id: 'alerts', label: 'Alerts', path: 'alerts', badge: Broken },
        {
          id: 'main',
          label: 'FLOps',
          path: '',
          children: [{ id: 'jobs', label: 'Jobs', path: 'jobs', badge: Broken }],
        },
      ]);

      expect(await screen.findByTestId('nav-flops-alerts')).toBeVisible();
      expect(screen.getByTestId('nav-flops-main-jobs')).toBeVisible();
      expect(screen.getByTestId('nav-badge-flops-alerts')).toBeEmptyDOMElement();
      expect(screen.getByTestId('nav-badge-flops-main-jobs')).toBeEmptyDOMElement();
      expect(screen.queryByTestId('contribution-error')).not.toBeInTheDocument();
      expect(screen.getByTestId('nav-demo-apps')).toBeVisible();
      expect(errors).toHaveBeenCalledWith(
        '[addon:flops] Badge of Alerts crashed',
        expect.objectContaining({ message: 'kaputt' }),
      );
    });
  });

  describe('addon pages', () => {
    const Page = ({ name }: { name: string }) => <h1>{name}</h1>;

    function loadFlops(registry: AddonRegistry) {
      act(() =>
        setEntry(registry, {
          name: 'flops',
          version: '1.0.0',
          sdk: '^0.1.0',
          entry: 'http://x/mf-manifest.json',
          origin: 'manager',
          basePath: '/addons/flops',
          state: 'loaded',
          definition: {
            id: 'flops',
            label: 'FLOps',
            routes: [
              { index: true, Component: () => <Page name="FLOps home" /> },
              {
                path: 'jobs',
                crumb: 'Jobs',
                children: [
                  { index: true, Component: () => <Page name="All jobs" /> },
                  { path: ':jobId', crumb: 'Job', Component: () => <Page name="One job" /> },
                ],
              },
              {
                path: 'settings',
                crumb: 'Settings',
                roles: ['Admin'],
                Component: () => <Page name="FLOps settings" />,
              },
            ],
          },
        }),
      );
    }

    it('shows the addon id until the addon is loaded, then its label and route crumbs', async () => {
      const { services, user } = renderApp({ modules, route: '/addons/flops/jobs/7' });

      const breadcrumbs = await screen.findByTestId('breadcrumbs');
      expect(breadcrumbs).toHaveTextContent(/^Homeflops$/);

      loadFlops(services.addons);
      expect(await screen.findByRole('heading', { name: 'One job' })).toBeVisible();
      expect(breadcrumbs).toHaveTextContent(/^HomeFLOpsJobsJob$/);
      expect(within(breadcrumbs).getByRole('link', { name: 'FLOps' })).toHaveAttribute(
        'href',
        '/addons/flops',
      );
      expect(within(breadcrumbs).getByRole('link', { name: 'Jobs' })).toHaveAttribute(
        'href',
        '/addons/flops/jobs',
      );

      await user.click(within(breadcrumbs).getByRole('link', { name: 'Jobs' }));
      expect(await screen.findByRole('heading', { name: 'All jobs' })).toBeVisible();
      expect(screen.getByTestId('breadcrumbs')).toHaveTextContent(/^HomeFLOpsJobs$/);

      await user.click(
        within(screen.getByTestId('breadcrumbs')).getByRole('link', { name: 'FLOps' }),
      );
      expect(await screen.findByRole('heading', { name: 'FLOps home' })).toBeVisible();
      expect(screen.getByTestId('breadcrumbs')).toHaveTextContent(/^HomeFLOps$/);
    });

    it('denies a role-restricted addon route with the shell 403 page', async () => {
      const { services } = renderApp({
        modules,
        route: '/addons/flops/settings',
        user: { username: 'alice' },
      });
      loadFlops(services.addons);

      expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeVisible();
      expect(screen.getByTestId('route-error')).toHaveTextContent(
        'You do not have permission to view this page.',
      );
      expect(screen.queryByRole('heading', { name: 'FLOps settings' })).not.toBeInTheDocument();
      // The 403 replaces only the addon page: the layout and its breadcrumb trail stay.
      expect(screen.getByTestId('breadcrumbs')).toHaveTextContent(/^HomeFLOpsSettings$/);
    });

    it('gives an addon page the full width when its routes ask for it', async () => {
      const { services, router } = renderApp({ modules, route: '/addons/canvas' });
      act(() =>
        setEntry(services.addons, {
          name: 'canvas',
          version: '1.0.0',
          sdk: '^0.1.0',
          entry: 'http://x/mf-manifest.json',
          origin: 'manager',
          basePath: '/addons/canvas',
          state: 'loaded',
          definition: {
            id: 'canvas',
            routes: [
              { index: true, Component: () => <Page name="Canvas home" /> },
              {
                path: 'board',
                fullWidth: true,
                children: [
                  { index: true, Component: () => <Page name="Board" /> },
                  { path: 'notes', fullWidth: false, Component: () => <Page name="Notes" /> },
                ],
              },
            ],
          },
        }),
      );
      const content = () => screen.getByTestId('page-content');

      expect(await screen.findByRole('heading', { name: 'Canvas home' })).toBeVisible();
      expect(content()).toHaveAttribute('data-width', 'default');

      // Children inherit the flag of their parent route...
      await act(() => router.navigate('/addons/canvas/board'));
      expect(await screen.findByRole('heading', { name: 'Board' })).toBeVisible();
      expect(content()).toHaveAttribute('data-width', 'full');

      // ...unless they set it themselves.
      await act(() => router.navigate('/addons/canvas/board/notes'));
      expect(await screen.findByRole('heading', { name: 'Notes' })).toBeVisible();
      expect(content()).toHaveAttribute('data-width', 'default');
    });

    it('opens a role-restricted addon route for users holding the role', async () => {
      const { services } = renderApp({ modules, route: '/addons/flops/settings' });
      loadFlops(services.addons);
      expect(await screen.findByRole('heading', { name: 'FLOps settings' })).toBeVisible();
    });
  });
});
