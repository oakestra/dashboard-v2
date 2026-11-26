import {
  compareTones,
  describeStatus,
  hasMetrics,
  instanceProblem,
  isAbnormalTone,
  parseClusterLocation,
  type Cluster,
} from '@oakestra/api';
import {
  formatBytes,
  formatPercent,
  formatRelativeTime,
  plural,
  type StatusTone,
} from '@oakestra/ui';

import { clusterPresentation, clusterUsage } from './lib';
import {
  clusterNodeId,
  shortWorker,
  UNKNOWN_WORKER,
  workerNodeId,
  type WorkerEntry,
  type WorkerInstance,
} from './topology';

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

/** The node already says how many clusters there are, so the card says how many are healthy. */
export function rootHoverLines(summary: RootSummary): string[] {
  const lines = [`${summary.reporting} of ${summary.total} reporting`];
  if (summary.reporting > 0) lines.push(`${plural(summary.workers, 'worker')} on those clusters`);
  return lines;
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

/**
 * The node shows the name and, for a reporting cluster, its worker count, so the card adds the
 * load. A silent cluster keeps its last report: the card dates it and says the figures are old,
 * and clusterUsage already drops zeros that would read as an idle cluster.
 */
export function clusterHoverLines(cluster: Cluster): string[] {
  const { state } = clusterPresentation(cluster);
  if (state === 'never-reported') return ['Registered, but has not sent a report yet'];
  const { cpuPercent, memoryPercent } = clusterUsage(cluster);
  const load = [
    cpuPercent === undefined ? undefined : `CPU ${formatPercent(cpuPercent, 0)}`,
    memoryPercent === undefined ? undefined : `memory ${formatPercent(memoryPercent, 0)}`,
  ].filter((part) => part !== undefined);
  if (state === 'reporting') return [`${load.join(', ')} in use`];
  const lines = [`Silent, last report ${formatRelativeTime(cluster.last_modified_timestamp)}`];
  lines.push(
    load.length > 0 ? `Last known: ${load.join(', ')} in use` : 'Figures are from its last report',
  );
  return lines;
}

/** Workers and instances that failed on a cluster, for the one sentence at the top of its panel. */
export function failedOnCluster(workers: ReadonlyMap<string, WorkerEntry>): {
  workers: number;
  instances: number;
} {
  let failedWorkers = 0;
  let instances = 0;
  for (const entry of workers.values()) {
    const failed = entry.instances.filter((candidate) => candidate.tone === 'destructive').length;
    if (failed > 0) failedWorkers += 1;
    instances += failed;
  }
  return { workers: failedWorkers, instances };
}

export function describeFailures(failed: {
  workers: number;
  instances: number;
}): string | undefined {
  if (failed.instances === 0) return undefined;
  return `${plural(failed.instances, 'instance')} on ${plural(failed.workers, 'worker')} failed.`;
}

export function restHoverLines(hidden: number): { title: string; lines: string[] } {
  return {
    title: `${hidden} more ${hidden === 1 ? 'worker' : 'workers'}`,
    lines: ['No instance you can see runs on them, so they are not listed.'],
  };
}

export interface ProblemItem {
  id: string;
  text: string;
  tone: StatusTone;
  stale?: boolean;
  /** The node to select, which opens its panel. */
  nodeId: string;
}

/**
 * What is abnormal on the screen, one item per kind, worst first. Failures on a silent cluster
 * are not counted: they are last known, and the silent item already covers that cluster.
 */
export function summarizeProblems(
  clusters: readonly Cluster[],
  workers: ReadonlyMap<string, ReadonlyMap<string, WorkerEntry>>,
  now: Date = new Date(),
): ProblemItem[] {
  const sorted = [...clusters].sort((a, b) => a.cluster_name.localeCompare(b.cluster_name));
  const items: ProblemItem[] = [];

  let failedInstances = 0;
  const failedClusters: Cluster[] = [];
  let firstFailed: string | undefined;
  for (const cluster of sorted) {
    const onCluster = workers.get(cluster._id);
    if (!onCluster || clusterPresentation(cluster).state !== 'reporting') continue;
    const { instances } = failedOnCluster(onCluster);
    if (instances === 0) continue;
    failedInstances += instances;
    failedClusters.push(cluster);
    if (firstFailed === undefined) {
      for (const [workerId, entry] of onCluster) {
        if (entry.instances.some((candidate) => candidate.tone === 'destructive')) {
          firstFailed = workerNodeId(cluster._id, workerId);
          break;
        }
      }
    }
  }
  if (failedClusters.length > 0 && firstFailed !== undefined) {
    items.push({
      id: 'failed',
      text:
        failedClusters.length === 1
          ? `${plural(failedInstances, 'failed instance')} on ${failedClusters[0]!.cluster_name}`
          : `${plural(failedInstances, 'failed instance')} on ${plural(failedClusters.length, 'cluster')}`,
      tone: 'destructive',
      nodeId: firstFailed,
    });
  }

  const silent = sorted.filter((cluster) => clusterPresentation(cluster).state === 'silent');
  if (silent.length > 0) {
    const first = silent[0]!;
    const { label } = clusterPresentation(first);
    items.push({
      id: 'silent',
      text:
        silent.length === 1
          ? `${first.cluster_name} ${label.toLowerCase()}, last report ${formatRelativeTime(first.last_modified_timestamp, now)}`
          : `${plural(silent.length, 'cluster')} ${label.toLowerCase()}`,
      tone: 'neutral',
      stale: true,
      nodeId: clusterNodeId(first._id),
    });
  }

  const never = sorted.filter((cluster) => clusterPresentation(cluster).state === 'never-reported');
  if (never.length > 0) {
    items.push({
      id: 'never-reported',
      text: `${plural(never.length, 'cluster')} ${never.length === 1 ? 'has' : 'have'} not reported yet`,
      tone: 'neutral',
      stale: true,
      nodeId: clusterNodeId(never[0]!._id),
    });
  }
  return items;
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

/** Instances an idle-looking zero could mislead about are left out: failed ones, unmeasured ones. */
function measuredInstances(entry: WorkerEntry): WorkerInstance[] {
  return entry.instances.filter(
    ({ instance, tone }) => !isAbnormalTone(tone) && hasMetrics(instance),
  );
}

/**
 * The node already names the services, so the card leads with why something failed, then counts
 * instances per service and sums what they use. `memory_percent` of an instance holds bytes.
 * `stale` (the cluster stopped reporting) hides the sums and says the state is last known.
 */
export function workerHoverLines(entry: WorkerEntry, stale: boolean): string[] {
  const lines: string[] = [];
  const problem = worstProblem(entry);
  if (problem) lines.push(`${problem.status}. ${problem.detail}`);
  const perService = new Map<string, number>();
  for (const { service } of entry.instances) {
    perService.set(service.microservice_name, (perService.get(service.microservice_name) ?? 0) + 1);
  }
  lines.push(
    [...perService]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => `${count} ${name}`)
      .join(', ') + (entry.instances.length === 1 ? ' instance' : ' instances'),
  );
  const measured = stale ? [] : measuredInstances(entry);
  if (measured.length > 0) {
    const cpu = measured.reduce((sum, { instance }) => sum + (instance.cpu_percent ?? 0), 0);
    const memory = measured.reduce((sum, { instance }) => sum + (instance.memory_percent ?? 0), 0);
    lines.push(`Using CPU ${formatPercent(cpu, 0)}, memory ${formatBytes(memory)}`);
  }
  if (stale) lines.push('Cluster stopped reporting, last known state');
  return lines;
}
