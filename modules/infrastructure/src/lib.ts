import { clusterReportState, type Cluster, type ClusterReportState } from '@oakestra/api';
import { BYTES_PER_MB, formatBytes, type StatusTone } from '@oakestra/ui';
import type { MapLocationTone } from '@oakestra/ui/location-map';

/**
 * `memory_in_mb` is the memory still AVAILABLE, summed over the workers' `mem.Available`, not the
 * installed total; `memory_percent` is the mean usage of the workers. The two cannot be combined
 * into "X% of Y", because the percentage is not a share of this figure.
 */
export function availableMemoryBytes(cluster: Cluster): number | undefined {
  return cluster.memory_in_mb === undefined ? undefined : cluster.memory_in_mb * BYTES_PER_MB;
}

export function describeAvailableMemory(cluster: Cluster): string {
  const available = availableMemoryBytes(cluster);
  // A cluster without workers reports 0 MB, which would read as "0 B available" next to a real one.
  if (available === undefined || available === 0) return '-';
  return `${formatBytes(available)} available`;
}

export interface ClusterTotals {
  clusters: number;
  activeClusters: number;
  activeNodes: number;
  cpuCores: number;
  memoryAvailableBytes: number;
  gpuCores: number;
}

/** Capacity counts only active clusters: a silent one keeps its last report but offers nothing. */
export function clusterTotals(clusters: readonly Cluster[]): ClusterTotals {
  const active = clusters.filter((cluster) => cluster.active);
  return {
    clusters: clusters.length,
    activeClusters: active.length,
    activeNodes: active.reduce((sum, c) => sum + (c.active_nodes ?? 0), 0),
    cpuCores: active.reduce((sum, c) => sum + (c.total_cpu_cores ?? 0), 0),
    memoryAvailableBytes: active.reduce((sum, c) => sum + (availableMemoryBytes(c) ?? 0), 0),
    gpuCores: active.reduce((sum, c) => sum + (c.total_gpu_cores ?? 0), 0),
  };
}

export interface ClusterPresentation {
  state: ClusterReportState;
  label: string;
  tone: StatusTone;
  /** Last known state without a recent report. */
  stale: boolean;
  mapTone: MapLocationTone;
}

/**
 * The one place that maps a cluster's report state onto presentation. Silent is abnormal but not
 * a failure we can name, so it is told apart by the stale hatch and wording, not by a fill.
 */
export function clusterPresentation(cluster: Cluster): ClusterPresentation {
  const state = clusterReportState(cluster);
  switch (state) {
    case 'reporting':
      return { state, label: 'Active', tone: 'success', stale: false, mapTone: 'default' };
    case 'silent':
      return { state, label: 'Silent', tone: 'neutral', stale: true, mapTone: 'muted' };
    case 'never-reported':
      return { state, label: 'Never reported', tone: 'neutral', stale: true, mapTone: 'muted' };
  }
}

export interface ClusterUsage {
  cpuPercent?: number;
  memoryPercent?: number;
  memoryAvailableBytes?: number;
  activeNodes?: number;
  /** The values are the last report of a cluster that stopped reporting, not current. */
  lastKnown: boolean;
}

/**
 * Figures that may be shown for a cluster. A reporting cluster shows everything, zeros included.
 * A silent one keeps only non-zero values: it may have lost all its workers (real zeros, which
 * read as dashes), and a zero kept from the last report would pass as an idle cluster. A cluster
 * that never reported has no values at all.
 */
export function clusterUsage(cluster: Cluster): ClusterUsage {
  const state = clusterReportState(cluster);
  const cpu = cluster.cpu_percent ?? cluster.aggregated_cpu_percent;
  const memory = availableMemoryBytes(cluster);
  if (state === 'reporting') {
    return {
      cpuPercent: cpu ?? 0,
      memoryPercent: cluster.memory_percent ?? 0,
      memoryAvailableBytes: memory,
      activeNodes: cluster.active_nodes ?? 0,
      lastKnown: false,
    };
  }
  const usage: ClusterUsage = { lastKnown: true };
  if (state === 'never-reported') return usage;
  if (cpu) usage.cpuPercent = cpu;
  if (cluster.memory_percent) usage.memoryPercent = cluster.memory_percent;
  if (memory) usage.memoryAvailableBytes = memory;
  if (cluster.active_nodes) usage.activeNodes = cluster.active_nodes;
  return usage;
}
