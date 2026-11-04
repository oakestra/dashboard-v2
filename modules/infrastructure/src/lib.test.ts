import type { Cluster } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import { clusterTotals, describeMemory } from './lib';

const cluster = (overrides: Partial<Cluster>) =>
  ({ _id: 'c', cluster_name: 'c', active: true, virtualization: [], ...overrides }) as Cluster;

describe('clusterTotals', () => {
  it('sums only active clusters', () => {
    const totals = clusterTotals([
      cluster({ active_nodes: 2, total_cpu_cores: 8, memory_in_mb: 1024, total_gpu_cores: 1 }),
      cluster({ active: false, active_nodes: 5, total_cpu_cores: 64, memory_in_mb: 4096 }),
    ]);

    expect(totals).toEqual({
      clusters: 2,
      activeClusters: 1,
      activeNodes: 2,
      cpuCores: 8,
      memoryBytes: 1024 * 1024 * 1024,
      gpuCores: 1,
    });
  });
});

describe('describeMemory', () => {
  it('shows a dash for a cluster that reports no memory', () => {
    expect(describeMemory(cluster({ memory_in_mb: 0 }))).toBe('-');
    expect(describeMemory(cluster({}))).toBe('-');
  });
});
