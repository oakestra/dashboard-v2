import {
  compareTones,
  describeStatus,
  instanceProblem,
  parseClusterLocation,
  type Cluster,
} from '@oakestra/api';
import { formatPercent, formatRelativeTime, plural } from '@oakestra/ui';

import { clusterPresentation, clusterUsage } from './lib';
import { shortWorker, UNKNOWN_WORKER, type WorkerEntry, type WorkerInstance } from './topology';

/** Facts about the whole platform, shared by the root's hover card and inspector panel. */
export interface RootSummary {
  total: number;
  reporting: number;
  silent: number;
  neverReported: number;
  /** Sum over reporting clusters only: a silent cluster's workers are last known, not capacity. */
  workers: number;
  notReporting: Cluster[];
}

export function summarizeRoot(clusters: readonly Cluster[]): RootSummary {
  const summary: RootSummary = {
    total: clusters.length,
    reporting: 0,
    silent: 0,
    neverReported: 0,
    workers: 0,
    notReporting: [],
  };
  for (const cluster of clusters) {
    const { state } = clusterPresentation(cluster);
    if (state === 'reporting') {
      summary.reporting += 1;
      summary.workers += cluster.active_nodes ?? 0;
      continue;
    }
    summary.notReporting.push(cluster);
    if (state === 'silent') summary.silent += 1;
    else summary.neverReported += 1;
  }
  summary.notReporting.sort((a, b) => a.cluster_name.localeCompare(b.cluster_name));
  return summary;
}

export function rootHoverLine(summary: RootSummary): string {
  const notReporting = summary.silent + summary.neverReported;
  return notReporting === 0
    ? plural(summary.total, 'cluster')
    : `${plural(summary.total, 'cluster')}, ${notReporting} not reporting`;
}

/** "48.14° N, 11.58° E" and the radius when the cluster states one. */
export function describeLocation(cluster: Cluster): string | undefined {
  const location = parseClusterLocation(cluster.cluster_location);
  if (!location) return undefined;
  const lat = `${Math.abs(location.latitude).toFixed(2)}° ${location.latitude < 0 ? 'S' : 'N'}`;
  const lng = `${Math.abs(location.longitude).toFixed(2)}° ${location.longitude < 0 ? 'W' : 'E'}`;
  const radius = location.radius ? `, radius ${location.radius} km` : '';
  return `${lat}, ${lng}${radius}`;
}

/** Reporting clusters have current numbers, the others only when they last reported. */
export function clusterHoverLines(cluster: Cluster): string[] {
  const { state, label } = clusterPresentation(cluster);
  const lines = [label];
  if (state === 'reporting') {
    const { cpuPercent, memoryPercent, activeNodes } = clusterUsage(cluster);
    lines.push(plural(activeNodes ?? 0, 'worker'));
    lines.push(
      `CPU ${formatPercent(cpuPercent, 0)}, memory ${formatPercent(memoryPercent, 0)} in use`,
    );
  } else if (state === 'silent') {
    lines.push(`Last report ${formatRelativeTime(cluster.last_modified_timestamp)}`);
  } else {
    lines.push('No report yet');
  }
  return lines;
}

export function sortWorkerInstances(instances: readonly WorkerInstance[]): WorkerInstance[] {
  return [...instances].sort(
    (a, b) =>
      compareTones(a.tone, b.tone) ||
      a.service.microservice_name.localeCompare(b.service.microservice_name) ||
      a.instance.instance_number - b.instance.instance_number,
  );
}

export function workerTitle(workerId: string): string {
  return workerId === UNKNOWN_WORKER ? 'Unknown worker' : shortWorker(workerId);
}

/** The worst instance on the worker that has something to say, e.g. a scheduler message. */
export function worstProblem(entry: WorkerEntry): { status: string; detail: string } | undefined {
  for (const { instance, service } of sortWorkerInstances(entry.instances)) {
    const detail = instanceProblem(instance);
    if (detail) {
      return {
        status: `${service.microservice_name}: ${describeStatus(instance.status).label}`,
        detail,
      };
    }
  }
  return undefined;
}

export function workerHoverLines(entry: WorkerEntry, clusterName: string | undefined): string[] {
  const lines = [clusterName ? `On ${clusterName}` : 'On an unknown cluster'];
  lines.push(`Runs ${[...entry.services].sort().join(', ')}`);
  const problem = worstProblem(entry);
  if (problem) lines.push(problem.status);
  return lines;
}
