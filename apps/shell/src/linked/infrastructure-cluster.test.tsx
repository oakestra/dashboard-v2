import type { Contributions } from '@oakestra/dashboard-sdk';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { linkedAddons } from '../app/modules';
import { addonSource } from '../core/addons/ui-addons';
import { mockStore } from '../test/msw';
import { renderApp } from '../test/render';

function activeCluster() {
  return mockStore.data.clusters.find((cluster) => cluster.active)!;
}

describe('infrastructure cluster page (linked addon)', () => {
  it('shows the stats, charts, capabilities and location of a cluster', async () => {
    const cluster = activeCluster();
    renderApp({
      linked: linkedAddons,
      route: `/infrastructure/clusters/${cluster._id}`,
    });

    expect(await screen.findByRole('heading', { name: cluster.cluster_name })).toBeVisible();
    const stats = screen.getByTestId('cluster-stats');
    expect(within(stats).getByText('CPU usage')).toBeVisible();
    expect(within(stats).getByText('Memory usage')).toBeVisible();
    expect(screen.getByRole('img', { name: /^CPU usage, latest value/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Memory usage, latest value/ })).toBeInTheDocument();
    expect(screen.getByText('Virtualization')).toBeVisible();
    expect(screen.getByText('runc')).toBeVisible();
    expect(await screen.findByLabelText('Cluster location')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent(
      `HomeInfrastructure${cluster.cluster_name}`,
    );
  });

  it('does not show fake zeros for a silent cluster', async () => {
    const silent = mockStore.data.clusters.find((cluster) => !cluster.active)!;
    renderApp({
      linked: linkedAddons,
      route: `/infrastructure/clusters/${silent._id}`,
    });

    const notice = await screen.findByTestId('cluster-notice');
    expect(notice).toHaveTextContent('This cluster is not reporting');
    expect(screen.queryByTestId('cluster-stats')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('No history yet')).not.toBeInTheDocument();
  });

  it('labels non-zero values of a silent cluster as last known', async () => {
    const silent = mockStore.data.clusters.find((cluster) => !cluster.active)!;
    Object.assign(silent, { cpu_percent: 31, memory_percent: 46, memory_in_mb: 17_696 });
    renderApp({
      linked: linkedAddons,
      route: `/infrastructure/clusters/${silent._id}`,
    });

    const notice = await screen.findByTestId('cluster-notice');
    expect(notice).toHaveTextContent('last known, not current');
    const stats = screen.getByTestId('cluster-stats');
    expect(within(stats).getByText('CPU usage, last known')).toBeVisible();
    expect(within(stats).getByText('Memory usage, last known')).toBeVisible();
    expect(within(stats).getByText(/available/)).toBeVisible();
    expect(within(stats).queryByText('Active nodes, last known')).not.toBeInTheDocument();
  });

  it('shows no values for a cluster that never reported', async () => {
    const silent = mockStore.data.clusters.find((cluster) => !cluster.active)!;
    delete silent.last_modified_timestamp;
    Object.assign(silent, { cpu_percent: 31 });
    renderApp({
      linked: linkedAddons,
      route: `/infrastructure/clusters/${silent._id}`,
    });

    expect(await screen.findByTestId('cluster-notice')).toHaveTextContent('not reported yet');
    expect(screen.getAllByText('Never reported')).toHaveLength(2);
    expect(screen.queryByTestId('cluster-stats')).not.toBeInTheDocument();
  });

  it('renders widgets contributed to cluster.widgets with the cluster id', async () => {
    const cluster = activeCluster();
    const { services } = renderApp({
      linked: linkedAddons,
      route: `/infrastructure/clusters/${cluster._id}`,
    });
    services.contributions.getState().register(
      { kind: 'core', id: 'probe', label: 'Probe' },
      {
        'cluster.widgets': [
          {
            id: 'probe-widget',
            title: 'Probe widget',
            component: ({ clusterId }) => <p>widget for {clusterId}</p>,
          },
        ],
      },
    );

    expect(await screen.findByText('Probe widget')).toBeVisible();
    expect(await screen.findByText(`widget for ${cluster._id}`)).toBeVisible();
  });

  it('marks cluster widgets of remote addons, not those of first-party packages', async () => {
    const { services } = renderApp({
      linked: linkedAddons,
      route: `/infrastructure/clusters/${activeCluster()._id}`,
    });
    const widget = (id: string, title: string): Contributions => ({
      'cluster.widgets': [{ id, title, component: () => <p>{id} body</p> }],
    });
    act(() => {
      const registry = services.contributions.getState();
      registry.register(
        addonSource(
          { name: 'flops', version: '1.2.0', basePath: '/addons/flops', origin: 'manager' },
          'Flops',
        ),
        widget('remote', 'Remote widget'),
      );
      registry.register(
        addonSource(
          { name: 'first-party', version: '0.1.0', basePath: '/first-party', origin: 'linked' },
          'First party',
        ),
        widget('linked', 'Linked widget'),
      );
    });

    expect(await screen.findByText('remote body')).toBeVisible();
    expect(screen.getByText('linked body')).toBeVisible();
    const tags = document.querySelectorAll('[data-slot="source-tag"]');
    expect(tags).toHaveLength(1);
    expect(tags[0]).toHaveTextContent('Flopsv1.2.0');
  });

  it('shows a not-found state for an unknown cluster', async () => {
    renderApp({ linked: linkedAddons, route: '/infrastructure/clusters/nope' });

    expect(await screen.findByText('Cluster not found')).toBeVisible();
    expect(screen.getByRole('link', { name: /All clusters/ })).toHaveAttribute(
      'href',
      '/infrastructure',
    );
  });

  it('refuses Application_Provider users', async () => {
    renderApp({
      linked: linkedAddons,
      route: '/infrastructure/clusters/nope',
      user: { username: 'alice' },
    });

    expect(await screen.findByText(/403|not allowed|permission/i)).toBeVisible();
    expect(screen.queryByText('Cluster not found')).not.toBeInTheDocument();
  });
});
