import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockStore } from '../test/msw';
import { renderApp } from '../test/render';
import { coreModules } from './modules';

const frontend = () => mockStore.data.services.find((s) => s.microservice_name === 'frontend')!;
const appBase = () => `/applications/${frontend().applicationID}`;
const serviceBase = () => `${appBase()}/services/${frontend()._id}`;

interface Case {
  url: () => string;
  heading: string | RegExp;
  /** Text the breadcrumb trail must contain, in order. */
  crumbs?: string;
}

// Each URL must reach its own page. The application and service trees are assembled from route
// arrays of three features, so a wrong nesting shows up here as a blank or mismatched page.
const cases: Case[] = [
  { url: () => '/', heading: /^Welcome, Admin/ },
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
    heading: 'Duplicate service',
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
  { url: () => '/help', heading: 'Help' },
];

describe('core module routes', () => {
  it.each(cases.map((c) => [c.url(), c] as const))('%s renders its page', async (_url, c) => {
    renderApp({ modules: coreModules, route: c.url() });

    expect(await screen.findByRole('heading', { level: 1, name: c.heading })).toBeVisible();
    if (c.crumbs) {
      expect(screen.getByTestId('breadcrumbs')).toHaveTextContent(`Home${c.crumbs}`);
    }
  });

  it('answers an unknown application id with the route error, also for the SLA pages', async () => {
    renderApp({ modules: coreModules, route: '/applications/nope/services/new' });

    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'New service' })).not.toBeInTheDocument();
  });
});
