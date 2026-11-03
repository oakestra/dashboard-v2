import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClusterCrumb } from './ClusterCrumb';

const clusters = [{ _id: 'a1', cluster_name: 'edge-berlin' }];

describe('<ClusterCrumb>', () => {
  it('renders the name of the cluster in the URL', async () => {
    renderInHost(<ClusterCrumb params={{ clusterId: 'a1' }} />, {
      api: { clusters: { list: () => Promise.resolve(clusters as never) } },
    });

    expect(await screen.findByText('edge-berlin')).toBeVisible();
  });

  it('falls back to a generic label for an unknown id', async () => {
    renderInHost(<ClusterCrumb params={{ clusterId: 'zz' }} />, {
      api: { clusters: { list: () => Promise.resolve(clusters as never) } },
    });

    expect(await screen.findByText('Cluster')).toBeVisible();
  });
});
