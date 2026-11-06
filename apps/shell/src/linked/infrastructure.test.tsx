import { http, HttpResponse } from '@oakestra/mocks';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import infrastructure from '@oakestra/module-infrastructure';

import { linkedAddons } from '../app/modules';
import { mockServer, mockStore, TEST_API_URL } from '../test/msw';
import { renderApp, type RenderAppOptions } from '../test/render';

const clusterList = () => screen.findByRole('list', { name: 'Clusters' });
const cardOf = (list: HTMLElement, name: string) =>
  within(list).getByRole('link', { name }).closest('li')!;

function renderInfrastructure(options: Partial<RenderAppOptions> = {}) {
  return renderApp({ linked: linkedAddons, route: '/infrastructure', ...options });
}

describe('infrastructure (linked addon)', () => {
  it('is linked at /infrastructure', () => {
    expect(linkedAddons).toContainEqual({ definition: infrastructure, mount: '/infrastructure' });
  });

  it('lists the clusters with a summary and the overview map', async () => {
    renderInfrastructure();

    const list = await clusterList();
    expect(within(list).getAllByRole('listitem')).toHaveLength(mockStore.data.clusters.length);
    expect(within(list).getByRole('link', { name: 'test-cluster' })).toBeVisible();
    expect(within(list).getByText('Active')).toBeVisible();
    expect(within(list).getByText('Silent')).toBeVisible();
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

    await clusterList();
    expect(screen.queryByRole('link', { name: 'Open Grafana' })).not.toBeInTheDocument();
  });

  it('shows no data instead of zero usage for silent clusters', async () => {
    renderInfrastructure();
    const card = cardOf(await clusterList(), 'edge-munich');

    expect(within(card).queryByText(/0%/)).not.toBeInTheDocument();
    expect(within(card).getByRole('img', { name: 'CPU (last known): no data' })).toBeVisible();
    expect(within(card).getByRole('img', { name: 'Memory (last known): no data' })).toBeVisible();
    expect(within(card).getByText('-')).toBeVisible();
  });

  it('shows non-zero last-known usage of a silent cluster as last known', async () => {
    const munich = mockStore.data.clusters.find(
      (cluster) => cluster.cluster_name === 'edge-munich',
    )!;
    Object.assign(munich, { cpu_percent: 31, memory_percent: 46, memory_in_mb: 17_696 });
    renderInfrastructure();
    const card = cardOf(await clusterList(), 'edge-munich');

    expect(within(card).getByRole('img', { name: 'CPU (last known): 31%' })).toBeVisible();
    expect(within(card).getByRole('img', { name: 'Memory (last known): 46%' })).toBeVisible();
    expect(within(card).getByText(/17\.3 GB/)).toHaveTextContent('(last known)');
  });

  it('never warns about a last-known value', async () => {
    const munich = mockStore.data.clusters.find(
      (cluster) => cluster.cluster_name === 'edge-munich',
    )!;
    Object.assign(munich, { cpu_percent: 95 });
    renderInfrastructure();
    const card = cardOf(await clusterList(), 'edge-munich');

    expect(within(card).getByRole('img', { name: /^CPU/ })).not.toHaveAttribute('data-abnormal');
  });

  it('marks a cluster that never reported', async () => {
    const munich = mockStore.data.clusters.find(
      (cluster) => cluster.cluster_name === 'edge-munich',
    )!;
    delete munich.last_modified_timestamp;
    renderInfrastructure();
    const card = cardOf(await clusterList(), 'edge-munich');

    expect(within(card).getByText('Never reported')).toBeVisible();
    expect(within(card).getByText('Never seen')).toBeVisible();
  });

  it('labels the summary tile as available memory', async () => {
    renderInfrastructure();
    const summary = await screen.findByTestId('summary');
    expect(within(summary).getByText('Memory available')).toBeVisible();
  });

  it('filters the list with the search box', async () => {
    const { user } = renderInfrastructure();
    const list = await clusterList();

    await user.type(screen.getByRole('searchbox', { name: /clusters/i }), 'munich');

    expect(within(list).queryByRole('link', { name: 'test-cluster' })).not.toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'edge-munich' })).toBeVisible();
  });

  it('sorts clusters without a figure below the ones reporting', async () => {
    const { user } = renderInfrastructure();
    const list = await clusterList();

    await user.click(screen.getByRole('combobox', { name: 'Sort Clusters' }));
    await user.click(await screen.findByRole('option', { name: 'Highest CPU usage' }));

    await waitFor(() =>
      expect(within(list).getAllByRole('listitem').at(-1)).toHaveTextContent('edge-munich'),
    );
  });

  it('opens the detail page from a card', async () => {
    const { user, router } = renderInfrastructure();
    const list = await clusterList();

    await user.click(within(list).getByRole('link', { name: 'test-cluster' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/infrastructure\/clusters\/.+/),
    );
  });

  it('refuses users without an infrastructure role', async () => {
    renderInfrastructure({ user: { username: 'alice' } });

    expect(await screen.findByText(/403|not allowed|permission/i)).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Clusters' })).not.toBeInTheDocument();
  });

  it('lets an infrastructure provider in', async () => {
    renderInfrastructure({ user: { username: 'bob' } });
    expect(await clusterList()).toBeVisible();
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
