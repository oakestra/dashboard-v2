import type { Cluster } from '@oakestra/api';

import { formatBytes, formatPercent } from '../../lib/format';

/** Cluster fields the API model does not type but real clusters send (the model is loose). */
export function extraNumber(cluster: Cluster, key: string): number | undefined {
  const value = cluster[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Addons, CSI and GPU drivers arrive as strings or objects, depending on the cluster version. */
export function itemLabel(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const named = (item as Record<string, unknown>).name;
    if (typeof named === 'string') return named;
  }
  return JSON.stringify(item) ?? String(item);
}

export function itemLabels(items: unknown): string[] {
  return Array.isArray(items) ? items.map(itemLabel) : [];
}

/** `memory_in_mb` is the cluster's total memory, `memory_percent` how much of it is used. */
export function totalMemoryBytes(cluster: Cluster): number | undefined {
  return cluster.memory_in_mb === undefined ? undefined : cluster.memory_in_mb * 1024 * 1024;
}

export function describeMemory(cluster: Cluster): string {
  const total = totalMemoryBytes(cluster);
  if (total === undefined) return '-';
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
export function summarize(clusters: readonly Cluster[]): ClusterTotals {
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
