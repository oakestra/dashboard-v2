import type { Cluster } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import { clusterPresentation, clusterTotals, clusterUsage, describeAvailableMemory } from './lib';

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
      memoryAvailableBytes: 1024 * 1024 * 1024,
      gpuCores: 1,
    });
  });
});

describe('describeAvailableMemory', () => {
  it('shows a dash for a cluster that reports no memory', () => {
    expect(describeAvailableMemory(cluster({ memory_in_mb: 0 }))).toBe('-');
    expect(describeAvailableMemory(cluster({}))).toBe('-');
  });

  it('labels the figure as available, not as a share of a total', () => {
    expect(describeAvailableMemory(cluster({ memory_in_mb: 2048, memory_percent: 40 }))).toBe(
      '2 GB available',
    );
  });
});

const silent = (overrides: Partial<Cluster> = {}) =>
  cluster({ active: false, last_modified_timestamp: new Date(), ...overrides });

describe('clusterPresentation', () => {
  it('tells reporting, silent and never-reported clusters apart', () => {
    expect(clusterPresentation(cluster({}))).toMatchObject({ label: 'Active', stale: false });
    expect(clusterPresentation(silent())).toMatchObject({
      label: 'Silent',
      stale: true,
      mapTone: 'muted',
    });
    expect(clusterPresentation(cluster({ active: false }))).toMatchObject({
      label: 'Never reported',
      stale: true,
      tone: 'neutral',
    });
  });
});

describe('clusterUsage', () => {
  it('keeps zeros for a reporting cluster', () => {
    expect(clusterUsage(cluster({ cpu_percent: 0, memory_percent: 0 }))).toMatchObject({
      cpuPercent: 0,
      memoryPercent: 0,
      lastKnown: false,
    });
  });

  it('keeps only non-zero last-known values of a silent cluster', () => {
    expect(
      clusterUsage(
        silent({ cpu_percent: 31, memory_percent: 0, memory_in_mb: 0, active_nodes: 2 }),
      ),
    ).toEqual({ cpuPercent: 31, activeNodes: 2, lastKnown: true });
  });

  it('treats a silent cluster that lost its workers as having no values', () => {
    expect(
      clusterUsage(silent({ cpu_percent: 0, memory_percent: 0, memory_in_mb: 0, active_nodes: 0 })),
    ).toEqual({ lastKnown: true });
  });

  it('shows nothing for a cluster that never reported', () => {
    expect(clusterUsage(cluster({ active: false, cpu_percent: 12 }))).toEqual({ lastKnown: true });
  });
});
