import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockStore } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { infrastructureModule } from '../index';

function activeCluster() {
  return mockStore.data.clusters.find((cluster) => cluster.active)!;
}

describe('<ClusterDetailPage>', () => {
  it('shows the stats, charts, capabilities and location of a cluster', async () => {
    const cluster = activeCluster();
    renderApp({
      modules: [infrastructureModule],
      route: `/infrastructure/clusters/${cluster._id}`,
    });

    expect(await screen.findByRole('heading', { name: cluster.cluster_name })).toBeVisible();
    const stats = screen.getByTestId('cluster-stats');
    expect(within(stats).getByText('CPU usage')).toBeVisible();
    expect(within(stats).getByText('Memory usage')).toBeVisible();
    expect(screen.getByRole('img', { name: /^CPU usage, latest value/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Memory usage, latest value/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Virtualization' })).toBeVisible();
    expect(screen.getByText('runc')).toBeVisible();
    expect(await screen.findByLabelText('Cluster location')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Infrastructure');
  });

  it('renders widgets contributed to cluster.widgets with the cluster id', async () => {
    const cluster = activeCluster();
    const { services } = renderApp({
      modules: [infrastructureModule],
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

  it('shows a not-found state for an unknown cluster', async () => {
    renderApp({ modules: [infrastructureModule], route: '/infrastructure/clusters/nope' });

    expect(await screen.findByText('Cluster not found')).toBeVisible();
    expect(screen.getByRole('link', { name: /All clusters/ })).toHaveAttribute(
      'href',
      '/infrastructure',
    );
  });

  it('refuses Application_Provider users', async () => {
    renderApp({
      modules: [infrastructureModule],
      route: '/infrastructure/clusters/nope',
      user: { username: 'alice' },
    });

    expect(await screen.findByText(/403|not allowed|permission/i)).toBeVisible();
    expect(screen.queryByText('Cluster not found')).not.toBeInTheDocument();
  });
});
