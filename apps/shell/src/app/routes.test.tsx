import { useAddonPath } from '@oakestra/dashboard-sdk';
import { act, screen, within } from '@testing-library/react';
import { Link } from 'react-router';
import { describe, expect, it } from 'vitest';

import { setEntry } from '../core/addons/addon-registry';
import { mockStore } from '../test/msw';
import { renderApp } from '../test/render';
import { coreModules, linkedAddons } from './modules';

const frontend = () => mockStore.data.services.find((s) => s.microservice_name === 'frontend')!;
const appBase = () => `/applications/${frontend().applicationID}`;
const serviceBase = () => `${appBase()}/services/${frontend()._id}`;

interface Case {
  url: () => string;
  heading: string | RegExp;
  /** Text the breadcrumb trail must contain, in order. */
  crumbs?: string;
}

// Each URL must reach its own page. The application tree nests services, instances and the SLA
// forms below `:appId`, so a wrong nesting shows up here as a blank or mismatched page.
const cases: Case[] = [
  { url: () => '/', heading: 'Overview' },
  { url: () => '/applications', heading: 'Applications', crumbs: 'Applications' },
  { url: () => appBase(), heading: 'webshop', crumbs: 'Applicationswebshop' },
  {
    url: () => `${appBase()}/services/new`,
    heading: 'New service',
    crumbs: 'ApplicationswebshopNew service',
  },
  { url: () => serviceBase(), heading: /^frontend/, crumbs: 'Applicationswebshopfrontend' },
  {
    url: () => `${serviceBase()}/duplicate`,
    heading: 'Duplicate frontend',
    crumbs: 'ApplicationswebshopfrontendDuplicate',
  },
  {
    url: () => `${serviceBase()}/instances/0`,
    heading: /^frontend #0/,
    crumbs: 'ApplicationswebshopfrontendInstance 0',
  },
  { url: () => '/infrastructure', heading: 'Infrastructure' },
  {
    url: () => `/infrastructure/clusters/${mockStore.data.clusters[0]!._id}`,
    heading: mockStore.data.clusters[0]!.cluster_name,
    crumbs: `Infrastructure${mockStore.data.clusters[0]!.cluster_name}`,
  },
  { url: () => '/users', heading: 'Users' },
  { url: () => '/organizations', heading: 'Organizations' },
  {
    url: () => `/organizations/${mockStore.data.organizations[0]!._id}`,
    heading: mockStore.data.organizations[0]!.name,
    crumbs: `Organizations${mockStore.data.organizations[0]!.name}`,
  },
  { url: () => '/profile', heading: 'Profile' },
  { url: () => '/settings', heading: 'Settings' },
  { url: () => '/settings/addons', heading: 'Addons', crumbs: 'AddonsInstalled' },
  { url: () => '/addon-manager', heading: 'Addons', crumbs: 'AddonsInstalled' },
  { url: () => '/addon-manager/installed', heading: 'Addons', crumbs: 'AddonsInstalled' },
  { url: () => '/addon-manager/marketplace', heading: 'Addons', crumbs: 'AddonsMarketplace' },
  { url: () => '/help', heading: 'Help', crumbs: 'Help' },
];

describe('core module and linked addon routes', () => {
  it.each(cases.map((c) => [c.url(), c] as const))('%s renders its page', async (_url, c) => {
    renderApp({ modules: coreModules, linked: linkedAddons, route: c.url() });

    expect(await screen.findByRole('heading', { level: 1, name: c.heading })).toBeVisible();
    if (c.crumbs) {
      expect(screen.getByTestId('breadcrumbs')).toHaveTextContent(`Home${c.crumbs}`);
    }
  });

  it('answers an unknown application id with a not-found page, also for the SLA pages', async () => {
    renderApp({
      modules: coreModules,
      linked: linkedAddons,
      route: '/applications/nope/services/new',
    });

    expect(await screen.findByText('Application not found')).toBeVisible();
    expect(screen.getByRole('link', { name: 'All applications' })).toHaveAttribute(
      'href',
      '/applications',
    );
    expect(screen.queryByLabelText('Service name')).not.toBeInTheDocument();
  });
});

describe('preset routes', () => {
  it('leaves out the routes of disabled modules and redirects / to home', async () => {
    const { router } = renderApp({
      modules: coreModules,
      linked: linkedAddons,
      route: '/',
      preset: { modules: ['applications', 'help'], home: '/applications' },
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Applications' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/applications');

    await act(() => router.navigate('/infrastructure'));
    expect(await screen.findByTestId('not-found')).toBeVisible();

    await act(() => router.navigate('/help'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Help' })).toBeVisible();
  });

  it('leaves out linked addons the preset does not list', async () => {
    renderApp({
      modules: coreModules,
      linked: linkedAddons,
      route: '/help',
      preset: { modules: ['overview'] },
    });
    expect(await screen.findByTestId('not-found')).toBeVisible();
  });

  it('keeps the overview at / when it is enabled, whatever home says', async () => {
    renderApp({
      modules: coreModules,
      route: '/',
      preset: { modules: ['overview'], home: '/help' },
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  });

  describe('mounted addons', () => {
    const acme = {
      name: 'acme-infra',
      version: '1.0.0',
      sdk: '^0.1.0',
      entry: '/bundled-addons/acme-infra/mf-manifest.json',
      mount: '/infrastructure',
    };

    function Clusters() {
      const path = useAddonPath();
      return (
        <>
          <h1>Acme clusters</h1>
          <Link to={path('clusters', 'eu 1')}>EU</Link>
        </>
      );
    }

    function render(route: string) {
      const result = renderApp({
        modules: coreModules,
        route,
        preset: { modules: ['overview', 'applications'], addons: [acme] },
      });
      act(() =>
        setEntry(result.services.addons, {
          ...acme,
          origin: 'preset',
          basePath: acme.mount,
          state: 'loaded',
          definition: {
            id: acme.name,
            label: 'Acme infrastructure',
            routes: [
              { index: true, Component: Clusters },
              { path: 'clusters/:id', crumb: 'Cluster', Component: () => <h1>One cluster</h1> },
            ],
          },
        }),
      );
      return result;
    }

    it('renders the addon at its mount, with its crumbs and base path', async () => {
      const { user } = render('/infrastructure');

      expect(await screen.findByRole('heading', { level: 1, name: 'Acme clusters' })).toBeVisible();
      const breadcrumbs = screen.getByTestId('breadcrumbs');
      expect(breadcrumbs).toHaveTextContent(/^HomeAcme infrastructure$/);

      const link = screen.getByRole('link', { name: 'EU' });
      expect(link).toHaveAttribute('href', '/infrastructure/clusters/eu%201');
      await user.click(link);
      expect(await screen.findByRole('heading', { level: 1, name: 'One cluster' })).toBeVisible();
      expect(breadcrumbs).toHaveTextContent(/^HomeAcme infrastructureCluster$/);
      expect(
        within(breadcrumbs).getByRole('link', { name: 'Acme infrastructure' }),
      ).toHaveAttribute('href', '/infrastructure');
    });

    it("shows the addon's own not found page below the mount", async () => {
      render('/infrastructure/nope');
      expect(await screen.findByTestId('addon-page-not-found')).toBeVisible();
    });
  });
});
