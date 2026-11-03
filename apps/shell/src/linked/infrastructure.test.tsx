import { http, HttpResponse } from '@oakestra/mocks';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import infrastructure from '@oakestra/module-infrastructure';

import { linkedAddons } from '../app/modules';
import { mockServer, mockStore, TEST_API_URL } from '../test/msw';
import { renderApp, type RenderAppOptions } from '../test/render';

function renderInfrastructure(options: Partial<RenderAppOptions> = {}) {
  return renderApp({ linked: linkedAddons, route: '/infrastructure', ...options });
}

describe('infrastructure (linked addon)', () => {
  it('is linked at /infrastructure', () => {
    expect(linkedAddons).toContainEqual({ definition: infrastructure, mount: '/infrastructure' });
  });

  it('lists the clusters with a summary and the overview map', async () => {
    renderInfrastructure();

    const table = await screen.findByRole('table', { name: 'Clusters' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(mockStore.data.clusters.length);
    expect(within(table).getByRole('link', { name: 'test-cluster' })).toBeVisible();
    expect(within(table).getByText('Active')).toBeVisible();
    expect(within(table).getByText('Inactive')).toBeVisible();
    expect(within(screen.getByTestId('summary')).getByText('Clusters')).toBeVisible();
    expect(await screen.findByLabelText('Cluster locations')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent(/^HomeInfrastructure$/);
    expect(screen.getByTestId('nav-infrastructure-infrastructure')).toHaveAttribute(
      'href',
      '/infrastructure',
    );
  });

  it("links to the deployment's Grafana from the config", async () => {
    renderInfrastructure({ config: { grafanaUrl: 'https://grafana.example/d/oakestra' } });

    const link = await screen.findByRole('link', { name: 'Open Grafana' });
    expect(link).toHaveAttribute('href', 'https://grafana.example/d/oakestra');
  });

  it('has no Grafana button without a configured Grafana', async () => {
    renderInfrastructure();

    await screen.findByRole('table', { name: 'Clusters' });
    expect(screen.queryByRole('link', { name: 'Open Grafana' })).not.toBeInTheDocument();
  });

  it('shows dashes instead of zero usage for inactive clusters', async () => {
    renderInfrastructure();
    const table = await screen.findByRole('table', { name: 'Clusters' });
    const row = within(table).getByRole('link', { name: 'edge-munich' }).closest('tr')!;

    expect(within(row).queryByText(/0%/)).not.toBeInTheDocument();
    expect(within(row).getAllByText('-').length).toBeGreaterThanOrEqual(2);
  });

  it('filters the table with the search box', async () => {
    const { user } = renderInfrastructure();
    const table = await screen.findByRole('table', { name: 'Clusters' });

    await user.type(screen.getByRole('searchbox', { name: /clusters/i }), 'munich');

    expect(within(table).queryByRole('link', { name: 'test-cluster' })).not.toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'edge-munich' })).toBeVisible();
  });

  it('opens the detail page when a row is clicked', async () => {
    const { user, router } = renderInfrastructure();
    const table = await screen.findByRole('table', { name: 'Clusters' });

    await user.click(within(table).getByText('Active'));

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/infrastructure\/clusters\/.+/),
    );
  });

  it('refuses users without an infrastructure role', async () => {
    renderInfrastructure({ user: { username: 'alice' } });

    expect(await screen.findByText(/403|not allowed|permission/i)).toBeVisible();
    expect(screen.queryByRole('table', { name: 'Clusters' })).not.toBeInTheDocument();
  });

  it('lets an infrastructure provider in', async () => {
    renderInfrastructure({ user: { username: 'bob' } });
    expect(await screen.findByRole('table', { name: 'Clusters' })).toBeVisible();
  });

  it('explains how clusters register when there are none', async () => {
    mockServer.use(http.get(`${TEST_API_URL}/clusters/`, () => HttpResponse.json([])));
    renderInfrastructure();

    expect(await screen.findByText('No clusters yet')).toBeVisible();
    expect(screen.getByRole('link', { name: /Oakestra docs/ })).toHaveAttribute(
      'href',
      'https://www.oakestra.io/docs/',
    );
  });

  it('notes clusters that cannot be placed on the map', async () => {
    mockServer.use(
      http.get(`${TEST_API_URL}/clusters/`, () =>
        HttpResponse.json([
          { _id: 'a', cluster_name: 'placed', cluster_location: '52.5,13.4,10', active: true },
          { _id: 'b', cluster_name: 'lost', cluster_location: '', active: true },
        ]),
      ),
    );
    renderInfrastructure();

    expect(await screen.findByTestId('map-skipped')).toHaveTextContent('1 cluster not shown');
  });

  it('shows an error with retry when the clusters cannot be loaded', async () => {
    mockServer.use(
      http.get(`${TEST_API_URL}/clusters/`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    renderInfrastructure();

    expect(await screen.findByText('Could not load clusters')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
