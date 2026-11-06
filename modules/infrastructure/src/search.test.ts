import type { Cluster } from '@oakestra/api';
import { createCommandContext } from '@oakestra/dashboard-sdk/testing';
import { ServerIcon } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { searchClusters } from './search';

const cluster = (overrides: Partial<Cluster>) =>
  ({ _id: 'c1', cluster_name: 'edge-munich', active: true, ...overrides }) as Cluster;

describe('searchClusters', () => {
  const context = (clusters: Cluster[]) =>
    createCommandContext({
      addon: { addonId: 'infrastructure', basePath: '/infrastructure' },
      api: { clusters: { list: () => Promise.resolve(clusters) } },
    });

  it('finds clusters by name and links them below the mount', async () => {
    const results = await searchClusters(
      'EDGE',
      context([cluster({}), cluster({ _id: 'c2', cluster_name: 'core' })]),
    );
    expect(results).toEqual([
      {
        id: 'c1',
        label: 'edge-munich',
        icon: ServerIcon,
        description: 'Cluster, active',
        path: '/infrastructure/clusters/c1',
      },
    ]);
  });

  it('says when a cluster is not reporting, without calling it a problem', async () => {
    const [result] = await searchClusters(
      'edge',
      context([cluster({ active: false, last_modified_timestamp: new Date() })]),
    );
    expect(result?.description).toBe('Cluster, silent');
    expect(result?.tone).toBeUndefined();
  });

  it('asks the backend once for a whole typing session', async () => {
    const list = vi.fn(() => Promise.resolve([cluster({})]));
    const ctx = createCommandContext({ api: { clusters: { list } } });
    await searchClusters('ed', ctx);
    await searchClusters('edg', ctx);
    expect(list).toHaveBeenCalledOnce();
  });
});
