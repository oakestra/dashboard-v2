import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClustersTile } from './ClustersTile';

const clusters = [
  { _id: 'a1', cluster_name: 'edge-berlin', active: true, active_nodes: 3 },
  { _id: 'b2', cluster_name: 'edge-paris', active: false, active_nodes: 1 },
];
const api = { clusters: { list: () => Promise.resolve(clusters as never) } };
const addon = { addonId: 'infrastructure', basePath: '/infrastructure' };

function tile() {
  return screen.getByText('Clusters').closest<HTMLElement>('[data-slot="stat-card"]')!;
}

describe('<ClustersTile>', () => {
  it('counts active clusters and their nodes, linking infrastructure roles to the page', async () => {
    renderInHost(<ClustersTile />, {
      api,
      addon,
      user: { username: 'bob', roles: ['Infrastructure_Provider'] },
    });

    await waitFor(() => expect(tile()).toHaveTextContent('1/2active, 3 nodes'));
    expect(tile()).toHaveAttribute('href', '/infrastructure');
  });

  it('stays a plain tile for users who may not open the infrastructure pages', async () => {
    renderInHost(<ClustersTile />, {
      api,
      addon,
      user: { username: 'alice', roles: ['Application_Provider'] },
    });

    await waitFor(() => expect(tile()).toHaveTextContent('1/2'));
    expect(tile()).not.toHaveAttribute('href');
  });

  it('says so when the clusters cannot be loaded', async () => {
    renderInHost(<ClustersTile />, {
      api: { clusters: { list: () => Promise.reject(new Error('down')) } },
      addon,
    });

    expect(await screen.findByText('Could not load clusters')).toBeVisible();
    expect(tile()).toHaveTextContent('-');
  });
});
