import { BYTES_PER_MB, formatBytes, formatPercent } from '@oakestra/ui';
import type { Cluster } from '@oakestra/api';
import type { StatusTone } from '@oakestra/ui';

/** `memory_in_mb` is the cluster's total memory, `memory_percent` how much of it is used. */
export function totalMemoryBytes(cluster: Cluster): number | undefined {
  return cluster.memory_in_mb === undefined ? undefined : cluster.memory_in_mb * BYTES_PER_MB;
}

export function describeMemory(cluster: Cluster): string {
  const total = totalMemoryBytes(cluster);
  // An inactive cluster reports 0 MB, which would read as "0% of 0 B" next to a real cluster.
  if (total === undefined || total === 0) return '-';
  const used =
    cluster.memory_percent === undefined ? '' : `${formatPercent(cluster.memory_percent)} of `;
  return `${used}${formatBytes(total)}`;
}

export interface ClusterTotals {
  clusters: number;
  activeClusters: number;
  activeNodes: number;
  cpuCores: number;
  memoryBytes: number;
  gpuCores: number;
}

/** Capacity counts only active clusters: an inactive one keeps its last report but offers nothing. */
export function clusterTotals(clusters: readonly Cluster[]): ClusterTotals {
  const active = clusters.filter((cluster) => cluster.active);
  return {
    clusters: clusters.length,
    activeClusters: active.length,
    activeNodes: active.reduce((sum, c) => sum + (c.active_nodes ?? 0), 0),
    cpuCores: active.reduce((sum, c) => sum + (c.total_cpu_cores ?? 0), 0),
    memoryBytes: active.reduce((sum, c) => sum + (totalMemoryBytes(c) ?? 0), 0),
    gpuCores: active.reduce((sum, c) => sum + (c.total_gpu_cores ?? 0), 0),
  };
}

/** Inactive means registered but not reporting: worth a look, but not a failure. */
export function clusterTone(active: boolean): StatusTone {
  return active ? 'success' : 'warning';
}
