import {
  clusterCpuPercent,
  clusterReportState,
  clusterStateLabel,
  schedulerDetail,
  type Cluster,
  type Instance,
  type Service,
} from '@oakestra/api';
import {
  formatBytes,
  formatPercent,
  formatRelativeTime,
  plural,
  type StatusTone,
} from '@oakestra/ui';

import {
  compareTones,
  describeStatus,
  hasMetrics,
  instanceProblem,
  isAbnormalTone,
} from '../services/status';
import {
  clusterDisplayName,
  connectivityLinks,
  instancesByCluster,
  notRunningReason,
  notRunningTone,
  parseTopologyNodeId,
  placementNodeId,
} from './topology';

export type TopologySelection =
  | {
      kind: 'placement';
      service: Service;
      clusterId: string;
      cluster: Cluster | undefined;
      clusterName: string;
      instances: Instance[];
      calls: Service[];
      calledBy: Service[];
    }
  | { kind: 'unplaced-service'; service: Service; calls: Service[]; calledBy: Service[] }
  | {
      kind: 'cluster';
      clusterId: string;
      cluster: Cluster | undefined;
      name: string;
      services: Service[];
    }
  | { kind: 'unplaced'; services: Service[] };

const servicesOnCluster = (services: readonly Service[], clusterId: string) =>
  services.filter((service) => instancesByCluster(service).has(clusterId));

const unplacedServices = (services: readonly Service[]) =>
  services.filter((service) => instancesByCluster(service).size === 0);

/**
 * What a node id stands for right now. `undefined` when the id is malformed or stale (a service
 * that was deleted, a cluster that no longer runs anything of this application), so a link
 * restored from the URL never opens an empty panel.
 */
export function resolveTopologyNode(
  id: string,
  services: readonly Service[],
  clusters: readonly Cluster[],
): TopologySelection | undefined {
  const ref = parseTopologyNodeId(id);
  if (!ref) return undefined;
  const clusterOf = (clusterId: string) => clusters.find((c) => c._id === clusterId);

  if (ref.kind === 'unplaced') {
    const members = unplacedServices(services);
    return members.length > 0 ? { kind: 'unplaced', services: members } : undefined;
  }
  if (ref.kind === 'cluster') {
    const members = servicesOnCluster(services, ref.clusterId);
    if (members.length === 0) return undefined;
    const cluster = clusterOf(ref.clusterId);
    return {
      kind: 'cluster',
      clusterId: ref.clusterId,
      cluster,
      name: clusterDisplayName(ref.clusterId, cluster),
      services: members,
    };
  }
  const service = services.find((s) => s._id === ref.serviceId);
  if (!service) return undefined;
  const perCluster = instancesByCluster(service);
  const links = connectivityLinks(services);
  const neighbours = {
    calls: links.filter(([from]) => from._id === service._id).map(([, to]) => to),
    calledBy: links.filter(([, to]) => to._id === service._id).map(([from]) => from),
  };
  if (ref.clusterId === null) {
    return perCluster.size === 0 ? { kind: 'unplaced-service', service, ...neighbours } : undefined;
  }
  const instances = perCluster.get(ref.clusterId);
  if (!instances) return undefined;
  const cluster = clusterOf(ref.clusterId);
  return {
    kind: 'placement',
    service,
    clusterId: ref.clusterId,
    cluster,
    clusterName: clusterDisplayName(ref.clusterId, cluster),
    instances,
    ...neighbours,
  };
}

/** The worst instance of a placement decides its tone and label, as on the node. */
export function worstInstance(instances: readonly Instance[]): Instance | undefined {
  return [...instances].sort((a, b) =>
    compareTones(describeStatus(a.status).tone, describeStatus(b.status).tone),
  )[0];
}

export function clusterIsReporting(cluster: Cluster | undefined): boolean {
  return cluster === undefined || clusterReportState(cluster) === 'reporting';
}

const isAbnormalInstance = (instance: Instance) =>
  isAbnormalTone(describeStatus(instance.status).tone);

/**
 * Whether an instance's figures mean anything: a failed instance keeps leftover numbers that would
 * read as an idle one, and a silent cluster's are too old to pass as current.
 */
export function isMeasured(instance: Instance, reporting: boolean): boolean {
  return reporting && !isAbnormalInstance(instance) && hasMetrics(instance);
}

/** "Last report 3 hours ago", for a cluster whose values are only the last known ones. */
export function lastReportLine(cluster: Cluster): string {
  return cluster.last_modified_timestamp
    ? `Last report ${formatRelativeTime(cluster.last_modified_timestamp)}`
    : 'No report yet';
}

/** Mean usage over the workers, never "of" a capacity (see the cluster quirks in AGENTS.md). */
function clusterUsageLine(cluster: Cluster): string | undefined {
  const parts: string[] = [];
  const cpu = clusterCpuPercent(cluster);
  if (cpu !== undefined) parts.push(`CPU ${formatPercent(cpu, 0)}`);
  if (cluster.memory_percent !== undefined) {
    parts.push(`memory ${formatPercent(cluster.memory_percent, 0)}`);
  }
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * What the placement's instances use together. Instance `memory_percent` holds bytes (see the
 * backend quirks), so it is summed and shown as a size.
 */
export function placementUsageLine(
  instances: readonly Instance[],
  reporting: boolean,
): string | undefined {
  const measured = instances.filter((instance) => isMeasured(instance, reporting));
  if (measured.length === 0) return undefined;
  const cpu = measured.reduce((sum, instance) => sum + (instance.cpu_percent ?? 0), 0);
  const memory = measured.reduce((sum, instance) => sum + (instance.memory_percent ?? 0), 0);
  const usage = `CPU ${formatPercent(cpu, 0)}, memory ${formatBytes(memory)}`;
  if (instances.length === 1) return usage;
  return measured.length === instances.length
    ? `${usage} over ${instances.length} instances`
    : `${usage} (${measured.length} of ${instances.length} instances measured)`;
}

/** "cache", "api and cache", "api, cache and 2 more". */
function shortList(names: readonly string[]): string {
  if (names.length <= 2) return names.join(' and ');
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

function neighbourLines(calls: readonly Service[], calledBy: readonly Service[]): string[] {
  const name = (service: Service) => service.microservice_name;
  return [
    ...(calls.length > 0 ? [`Calls ${shortList(calls.map(name))}`] : []),
    ...(calledBy.length > 0 ? [`Called by ${shortList(calledBy.map(name))}`] : []),
  ];
}

/** "1 service", or "2 of 5 services" when only part of the whole is meant. */
const partOf = (part: number, whole: number, noun: string) =>
  part === whole ? plural(part, noun) : `${part} of ${plural(whole, noun)}`;

/** The one thing worth acting on in a node, shown at the top of the panel. */
export interface TopologyAttention {
  tone: 'destructive' | 'warning';
  headline: string;
  reason?: string;
  /** The instance whose page has the logs; the worst one when several are affected. */
  instanceNumber?: number;
}

/**
 * The failed or degraded instances of a placement, with the reason of the worst one, so nobody has
 * to open each instance to find out what is wrong.
 */
export function placementAttention(instances: readonly Instance[]): TopologyAttention | undefined {
  const abnormal = instances.filter(isAbnormalInstance);
  const worst = worstInstance(abnormal);
  if (!worst) return undefined;
  const status = describeStatus(worst.status);
  return {
    tone: status.tone === 'destructive' ? 'destructive' : 'warning',
    headline:
      abnormal.length === 1
        ? `Instance ${worst.instance_number}: ${status.label}`
        : `${partOf(abnormal.length, instances.length, 'instance')} need attention`,
    reason: instanceProblem(worst) ?? (status.hint || undefined),
    instanceNumber: worst.instance_number,
  };
}

/** One entry of the row above the graph; `nodeId` is what clicking it selects. */
export interface TopologyProblem {
  id: 'failed' | 'degraded' | 'unplaced' | 'silent';
  tone: StatusTone;
  text: string;
  nodeId: string;
}

interface ProblemPlacement {
  service: Service;
  clusterId: string;
  clusterName: string;
  instances: Instance[];
}

/**
 * What needs the owner right now, worst first, for the row above the graph. Empty when nothing is
 * abnormal, so a healthy application shows no row at all.
 *
 * A placement on a cluster that stopped reporting is only listed as such, not as failed or
 * degraded: its states are the last known ones, and counting them as current would send the owner
 * after a failure that may be long gone. Selecting it still shows those states.
 */
export function topologyProblems(
  services: readonly Service[],
  clusters: readonly Cluster[],
): TopologyProblem[] {
  const clusterById = new Map(clusters.map((cluster) => [cluster._id, cluster]));
  // By service name, then cluster name, so the node an item selects does not depend on the order
  // the backend happens to return.
  const sorted = [...services].sort((a, b) =>
    a.microservice_name.localeCompare(b.microservice_name),
  );
  const placements: ProblemPlacement[] = sorted.flatMap((service) =>
    [...instancesByCluster(service)]
      .map(([clusterId, instances]) => ({
        service,
        clusterId,
        clusterName: clusterDisplayName(clusterId, clusterById.get(clusterId)),
        instances,
      }))
      .sort((a, b) => a.clusterName.localeCompare(b.clusterName)),
  );
  const reporting = placements.filter((p) => clusterIsReporting(clusterById.get(p.clusterId)));
  const silent = placements.filter((p) => !clusterIsReporting(clusterById.get(p.clusterId)));
  const nodeOf = (p: ProblemPlacement) => placementNodeId(p.service._id, p.clusterId);

  const problems: TopologyProblem[] = [];
  const instancesWithTone = (tone: StatusTone) => {
    const hits = reporting.flatMap((p) =>
      p.instances.filter((i) => describeStatus(i.status).tone === tone).map(() => p),
    );
    return { count: hits.length, first: hits[0] };
  };

  const failed = instancesWithTone('destructive');
  if (failed.first) {
    problems.push({
      id: 'failed',
      tone: 'destructive',
      text: plural(failed.count, 'failed instance'),
      nodeId: nodeOf(failed.first),
    });
  }
  const degraded = instancesWithTone('warning');
  if (degraded.first) {
    problems.push({
      id: 'degraded',
      tone: 'warning',
      text: plural(degraded.count, 'degraded instance'),
      nodeId: nodeOf(degraded.first),
    });
  }

  // A service nobody deployed or one the scheduler is still working on is not a problem yet.
  const unplaced = sorted
    .filter((service) => instancesByCluster(service).size === 0)
    .map((service) => ({ service, tone: notRunningTone(service) }))
    .filter(({ tone }) => isAbnormalTone(tone));
  const worstUnplaced = [...unplaced].sort((a, b) => compareTones(a.tone, b.tone))[0];
  if (worstUnplaced) {
    problems.push({
      id: 'unplaced',
      tone: worstUnplaced.tone,
      text: `${plural(unplaced.length, 'service')} not placed`,
      nodeId: placementNodeId(worstUnplaced.service._id, null),
    });
  }

  const [firstSilent] = silent;
  if (firstSilent) {
    const silentServices = new Set(silent.map((p) => p.service._id)).size;
    problems.push({
      id: 'silent',
      tone: 'neutral',
      text:
        silent.length === 1
          ? `${firstSilent.service.microservice_name} on ${firstSilent.clusterName}: last known state`
          : silentServices === 1
            ? `${firstSilent.service.microservice_name} on ${silent.length} clusters that stopped reporting`
            : `${plural(silentServices, 'service')} on clusters that stopped reporting`,
      nodeId: nodeOf(firstSilent),
    });
  }

  // Stable, so items of the same tone keep the order above.
  return problems.sort((a, b) => compareTones(a.tone, b.tone));
}

/** The services of the application whose worst instance on the cluster failed or is degraded. */
export function clusterAttention(
  selection: Extract<TopologySelection, { kind: 'cluster' }>,
): TopologyAttention | undefined {
  const { services, clusterId, cluster } = selection;
  const tones = services
    .map((service) => instancesByCluster(service).get(clusterId) ?? [])
    .map((instances) => describeStatus(worstInstance(instances)?.status).tone)
    .filter(isAbnormalTone);
  if (tones.length === 0) return undefined;
  const reporting = clusterIsReporting(cluster);
  return {
    tone: tones.includes('destructive') ? 'destructive' : 'warning',
    headline: `${partOf(tones.length, services.length, 'service')} unhealthy${reporting ? '' : ' at the last report'}`,
  };
}

export interface SelectionSummary {
  title: string;
  /** What the node is, for the panel's small heading. */
  kind: string;
  tone: StatusTone;
  stale: boolean;
  statusLabel: string;
  /**
   * The hover card's facts: only what the node does not show. Its label, status and count are
   * already on it.
   */
  lines: string[];
}

export function summarizeSelection(selection: TopologySelection): SelectionSummary {
  switch (selection.kind) {
    case 'placement': {
      const { service, instances, cluster } = selection;
      const status = describeStatus(worstInstance(instances)?.status);
      const reporting = clusterIsReporting(cluster);
      const attention = placementAttention(instances);
      const state = attention ? attention.reason : placementUsageLine(instances, reporting);
      return {
        title: service.microservice_name,
        kind: 'Service',
        tone: status.tone,
        stale: !reporting,
        statusLabel: status.label,
        lines: [
          ...(state ? [state] : []),
          ...(cluster && !reporting ? [`Last known state. ${lastReportLine(cluster)}`] : []),
          ...neighbourLines(selection.calls, selection.calledBy),
        ],
      };
    }
    case 'unplaced-service': {
      const { service } = selection;
      const reason =
        schedulerDetail(service.status_detail) ??
        (describeStatus(service.status).hint || undefined);
      return {
        title: service.microservice_name,
        kind: 'Service',
        tone: notRunningTone(service),
        stale: false,
        statusLabel: notRunningReason(service),
        lines: [
          ...(reason ? [reason] : []),
          ...neighbourLines(selection.calls, selection.calledBy),
        ],
      };
    }
    case 'cluster': {
      const { cluster, name } = selection;
      const state = cluster ? clusterReportState(cluster) : 'reporting';
      const reporting = state === 'reporting';
      const load = cluster
        ? reporting
          ? clusterUsageLine(cluster)
          : lastReportLine(cluster)
        : undefined;
      const attention = clusterAttention(selection);
      return {
        title: name,
        kind: 'Cluster',
        tone: reporting ? 'success' : 'neutral',
        stale: !reporting,
        statusLabel: cluster ? clusterStateLabel(state) : 'Unknown',
        lines: [...(attention ? [attention.headline] : []), ...(load ? [load] : [])],
      };
    }
    case 'unplaced': {
      const { services } = selection;
      const abnormal = services.filter((s) => isAbnormalTone(notRunningTone(s))).length;
      return {
        title: 'Not running',
        kind: 'Group',
        tone: abnormal > 0 ? 'warning' : 'neutral',
        stale: false,
        statusLabel: abnormal > 0 ? 'Needs attention' : 'Idle',
        lines:
          abnormal > 0
            ? [`${partOf(abnormal, services.length, 'service')} failed or could not be placed`]
            : [],
      };
    }
  }
}
