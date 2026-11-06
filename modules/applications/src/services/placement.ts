import {
  clusterReportState,
  isPlacementFailure,
  isWorkerPlacementFailure,
  type Cluster,
  type ClusterReportState,
  type Service,
} from '@oakestra/api';
import { formatMegabytes, plural } from '@oakestra/ui';

/**
 * A client-side replay of the root scheduler's cluster filter (`MeetsBasicRequirements` in
 * placement.go, `filterRequirements` in cpumemfit.go), so a person can see why a service was not
 * placed. It mirrors that code on purpose: anything the scheduler does not read here is listed by
 * `notEvaluated` instead of being guessed at.
 *
 * Cluster figures are sums over workers, so passing every check only means the cluster was not
 * ruled out. That is why the wording stays at "passes cluster checks" and never promises a run.
 */

export interface PlacementLimits {
  /** In MB. */
  memory: number;
  vcpus: number;
}

export type PlacementBlocker = 'target' | 'runtime' | 'vcpus' | 'memory' | 'csi';

interface RowBase {
  cluster: Cluster;
  /** Named by the service's direct constraint. */
  isTarget: boolean;
}

export interface CheckedPlacementRow extends RowBase {
  state: 'blocked' | 'passes';
  blockers: readonly PlacementBlocker[];
  /** Total cores of the cluster, which is what the scheduler compares against. */
  vcpus: number;
  /** Memory available at the last report, in MB. */
  memory: number;
  runtimes: readonly string[];
  missingCsiDrivers: readonly string[];
}

/** Clusters that are not active are never handed to the scheduler, so nothing was checked. */
export interface SilentPlacementRow extends RowBase {
  state: 'silent';
  report: Exclude<ClusterReportState, 'reporting'>;
}

export type PlacementRow = CheckedPlacementRow | SilentPlacementRow;

const isChecked = (row: PlacementRow): row is CheckedPlacementRow => row.state !== 'silent';

/**
 * The status to explain, if any. The cluster manager writes NO_WORKER_CAPACITY onto the instance,
 * so a service that has other instances running can carry the failure only there.
 */
export function placementFailureStatus(service: Service): string | undefined {
  if (isPlacementFailure(service.status)) return service.status;
  return service.instance_list.find((instance) => isPlacementFailure(instance.status))?.status;
}

/** The cluster a direct constraint pins the service to. Like the scheduler's map, the last wins. */
export function directTarget(service: Service): string | undefined {
  const direct = service.constraints.filter((constraint) => constraint.type === 'direct').at(-1);
  return typeof direct?.cluster === 'string' && direct.cluster !== '' ? direct.cluster : undefined;
}

/**
 * The system manager stores `container` as `docker` when a service is created, so this only
 * matters for documents written before that. The scheduler then compares exact strings.
 */
function requiredRuntime(service: Service): string | undefined {
  return service.virtualization === 'container' ? 'docker' : service.virtualization;
}

export function requestedLimits(service: Service): PlacementLimits {
  return { memory: service.memory ?? 0, vcpus: service.vcpus ?? 0 };
}

function checkCluster(
  service: Service,
  cluster: Cluster,
  limits: PlacementLimits,
  target: string | undefined,
): PlacementRow {
  const isTarget = cluster.cluster_name === target;
  const report = clusterReportState(cluster);
  if (report !== 'reporting') return { cluster, isTarget, state: 'silent', report };

  // Missing figures count as 0, which is what the scheduler's Go structs decode them to.
  const vcpus = cluster.vcpus ?? 0;
  const memory = cluster.memory_in_mb ?? 0;
  const runtime = requiredRuntime(service);
  const missingCsiDrivers = service.volumes.flatMap(({ csi_driver: driver }) =>
    driver && !cluster.csi_drivers.includes(driver) ? [driver] : [],
  );

  const blockers: PlacementBlocker[] = [];
  if (target !== undefined && !isTarget) blockers.push('target');
  // A service without a runtime is a malformed job to the scheduler: it fails every candidate.
  if (runtime === undefined || !cluster.virtualization.includes(runtime)) blockers.push('runtime');
  if (memory < limits.memory) blockers.push('memory');
  if (vcpus < limits.vcpus) blockers.push('vcpus');
  if (missingCsiDrivers.length > 0) blockers.push('csi');

  return {
    cluster,
    isTarget,
    state: blockers.length === 0 ? 'passes' : 'blocked',
    blockers,
    vcpus,
    memory,
    runtimes: cluster.virtualization,
    missingCsiDrivers,
  };
}

const STATE_RANK: Record<PlacementRow['state'], number> = { passes: 0, blocked: 1, silent: 2 };

/** How much of the request the cluster covers, from 0 to 1. */
function coverage(row: CheckedPlacementRow, limits: PlacementLimits): number {
  const share = (offered: number, wanted: number) =>
    wanted <= 0 ? 1 : Math.min(1, offered / wanted);
  return (share(row.memory, limits.memory) + share(row.vcpus, limits.vcpus)) / 2;
}

function compareRows(limits: PlacementLimits) {
  return (a: PlacementRow, b: PlacementRow): number => {
    const byState = STATE_RANK[a.state] - STATE_RANK[b.state];
    if (byState !== 0) return byState;
    const byTarget = Number(b.isTarget) - Number(a.isTarget);
    if (byTarget !== 0) return byTarget;
    if (isChecked(a) && isChecked(b)) {
      const closest =
        a.blockers.length - b.blockers.length ||
        coverage(b, limits) - coverage(a, limits) ||
        b.memory - a.memory;
      if (closest !== 0) return closest;
    }
    return a.cluster.cluster_name.localeCompare(b.cluster.cluster_name);
  };
}

/**
 * One row per cluster, closest fit first and silent clusters last. `limits` replaces the service's
 * own request in the checks but not in the order: the table sits next to the what-if sliders, and
 * rows swapping places under the pointer would make it hard to follow one cluster.
 */
export function evaluatePlacement(
  service: Service,
  clusters: readonly Cluster[],
  limits?: PlacementLimits,
): PlacementRow[] {
  const requested = requestedLimits(service);
  const target = directTarget(service);
  const ranked = clusters
    .map((cluster) => checkCluster(service, cluster, requested, target))
    .sort(compareRows(requested));
  return limits ? ranked.map((row) => checkCluster(service, row.cluster, limits, target)) : ranked;
}

const BLOCKER_LABELS: Record<PlacementBlocker, string> = {
  target: 'direct constraint',
  runtime: 'runtime',
  memory: 'memory',
  vcpus: 'vCPU',
  csi: 'CSI driver',
};

const joinList = (items: readonly string[]) => new Intl.ListFormat('en').format(items);

const blockerList = (blockers: readonly PlacementBlocker[]) =>
  joinList(blockers.map((blocker) => BLOCKER_LABELS[blocker]));

export function describeRowResult(row: PlacementRow): string {
  if (row.state === 'silent') {
    return row.report === 'silent' ? 'Silent, not considered' : 'Never reported, not considered';
  }
  return row.state === 'passes'
    ? 'Passes cluster checks'
    : `Blocked by ${blockerList(row.blockers)}`;
}

export interface PlacementExplanation {
  title: string;
  detail: string;
}

function explainTarget(
  target: string,
  row: PlacementRow | undefined,
  workerFailure: boolean,
): PlacementExplanation {
  const pinned = `A direct constraint pins this service to ${target}, so no other cluster is tried.`;
  if (!row) {
    return {
      title: `Target cluster ${target} does not exist`,
      detail: `${pinned} No cluster has that name. Duplicate the service with another target.`,
    };
  }
  if (row.state === 'silent') {
    return {
      title:
        row.report === 'silent'
          ? `Target cluster ${target} is not reporting`
          : `Target cluster ${target} has never reported`,
      detail: `${pinned} The scheduler only considers active clusters. Wait for it to report, or duplicate the service with another target.`,
    };
  }
  if (row.state === 'blocked') {
    return {
      title: `Target cluster ${target} is blocked by ${blockerList(row.blockers)}`,
      detail: pinned,
    };
  }
  return workerFailure
    ? {
        title: `${target} passes cluster checks, but no single worker has room`,
        detail: `${pinned} Its totals are summed across workers, so they can pass while no one worker has all of it free.`,
      }
    : {
        title: `Target cluster ${target} passes cluster checks now`,
        detail: `${pinned} It did not when the scheduler last tried, so trying again may help.`,
      };
}

const passCount = (passing: number, active: number) =>
  `${passing} of ${plural(active, 'active cluster')} ${passing === 1 ? 'passes' : 'pass'}`;

/** The panel's headline: why this service is not placed, given the rows at its own request. */
export function explainPlacement(
  service: Service,
  rows: readonly PlacementRow[],
): PlacementExplanation {
  const status = placementFailureStatus(service);
  const workerFailure = isWorkerPlacementFailure(status);
  const target = directTarget(service);
  if (target !== undefined) {
    const row = rows.find((candidate) => candidate.isTarget);
    return explainTarget(target, row, workerFailure);
  }

  const active = rows.filter(isChecked);
  if (active.length === 0) {
    return {
      title: 'No cluster is reporting',
      detail: 'The scheduler only considers active clusters, and none is active right now.',
    };
  }

  const passing = active.filter((row) => row.state === 'passes').length;
  const count = passCount(passing, active.length);
  if (passing > 0 && workerFailure) {
    return {
      title: 'Cluster totals pass, but no single worker has room',
      detail: `${count} cluster checks. Totals are summed across workers, so they can pass while no one worker has all of it free. Lower the limits or free up a worker.`,
    };
  }
  if (passing > 0) {
    return {
      title: `${count} cluster checks now`,
      detail:
        'That was not so when the scheduler last tried, so trying again may help. These checks do not look at single workers.',
    };
  }

  const tally = (['target', 'runtime', 'memory', 'vcpus', 'csi'] as const).flatMap((blocker) => {
    const blocked = active.filter((row) => row.blockers.includes(blocker)).length;
    return blocked > 0 ? [`${BLOCKER_LABELS[blocker]} on ${plural(blocked, 'cluster')}`] : [];
  });
  return {
    title: 'Every active cluster is blocked',
    detail: `Blocked by ${joinList(tally)}.`,
  };
}

/**
 * Whether changing memory or vCPU can ever unblock a cluster. A pin to a silent cluster or a
 * missing runtime leaves the sliders nothing to do.
 */
export function limitsCanHelp(rows: readonly PlacementRow[]): boolean {
  return rows
    .filter(isChecked)
    .some((row) => row.blockers.every((blocker) => blocker === 'memory' || blocker === 'vcpus'));
}

/** The what-if result, read out on every change, so it repeats the limits it talks about. */
export function describeWhatIf(rows: readonly PlacementRow[], limits: PlacementLimits): string {
  const active = rows.filter(isChecked);
  const passing = active.filter((row) => row.state === 'passes');
  const asked = `At ${limits.vcpus} vCPU and ${formatMegabytes(limits.memory)}`;
  if (passing.length > 0) {
    const names = joinList(passing.map((row) => row.cluster.cluster_name));
    return `${asked}, ${passCount(passing.length, active.length)} cluster checks: ${names}. The scheduler still has to find one worker with that much free.`;
  }
  const closest = active[0];
  return closest
    ? `${asked}, no active cluster passes. Closest: ${closest.cluster.cluster_name}, blocked by ${blockerList(closest.blockers)}.`
    : `${asked}, no active cluster passes.`;
}

/** Slider ceiling: what the service asks for or the largest offer, whichever is higher. */
export function limitCeilings(service: Service, rows: readonly PlacementRow[]): PlacementLimits {
  const active = rows.filter(isChecked);
  const requested = requestedLimits(service);
  return {
    memory: Math.ceil(Math.max(1, requested.memory, ...active.map((row) => row.memory))),
    vcpus: Math.ceil(Math.max(1, requested.vcpus, ...active.map((row) => row.vcpus))),
  };
}

/** The sliders work in whole numbers of at least 1, the only values a copy link can carry. */
export function initialLimits(service: Service): PlacementLimits {
  const { memory, vcpus } = requestedLimits(service);
  return { memory: Math.max(1, Math.ceil(memory)), vcpus: Math.max(1, Math.ceil(vcpus)) };
}

export const MEMORY_SLIDER_STEPS = 1000;

/**
 * Memory is on a log scale: a request can be 500 GB while the offers are a few GB, and on a linear
 * track of that length every value a cluster could actually meet sits in the first pixels.
 */
export function memoryToPosition(memory: number, max: number): number {
  if (max <= 1) return 0;
  const position = (Math.log(Math.max(1, memory)) / Math.log(max)) * MEMORY_SLIDER_STEPS;
  return Math.min(MEMORY_SLIDER_STEPS, Math.round(position));
}

/** Rounded to three significant digits, so a copy asks for 18700 MB rather than 18693. */
export function positionToMemory(position: number, max: number): number {
  if (position >= MEMORY_SLIDER_STEPS) return max;
  const exact = max ** (position / MEMORY_SLIDER_STEPS);
  const unit = 10 ** Math.max(0, Math.floor(Math.log10(exact)) - 2);
  return Math.min(max, Math.max(1, Math.round(exact / unit) * unit));
}

/** Everything the service asks for that neither the scheduler's cluster filter nor this code read. */
export function describeNotEvaluated(service: Service): string | undefined {
  const resources = [
    service.vgpus ? 'vGPU' : undefined,
    service.vtpus ? 'vTPU' : undefined,
    service.storage ? 'storage' : undefined,
    service.bandwidth_in || service.bandwidth_out ? 'bandwidth' : undefined,
  ];
  const constraints = service.constraints.map((constraint) => {
    // The cluster's own scheduler reads the node of a direct constraint, the root does not.
    if (constraint.type === 'direct') return constraint.node ? 'target node' : undefined;
    return `${constraint.type} constraint`;
  });
  const skipped = [...new Set([...resources, ...constraints].filter((item) => item !== undefined))];
  return skipped.length > 0 ? `Not evaluated by these checks: ${joinList(skipped)}.` : undefined;
}
