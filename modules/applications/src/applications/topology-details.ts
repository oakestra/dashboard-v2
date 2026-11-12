import {
  clusterCpuPercent,
  clusterReportState,
  clusterStateLabel,
  schedulerDetail,
  type Cluster,
  type Instance,
  type Service,
} from '@oakestra/api';
import { formatPercent, plural, type StatusTone } from '@oakestra/ui';

import {
  compareTones,
  describeStatus,
  instanceProblem,
  isAbnormalTone,
  summarizeStatuses,
} from '../services/status';
import {
  clusterDisplayName,
  instancesByCluster,
  notRunningReason,
  notRunningTone,
  parseTopologyNodeId,
} from './topology';

export type TopologySelection =
  | {
      kind: 'placement';
      service: Service;
      clusterId: string;
      cluster: Cluster | undefined;
      clusterName: string;
      instances: Instance[];
    }
  | { kind: 'unplaced-service'; service: Service }
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
  if (ref.clusterId === null) {
    return perCluster.size === 0 ? { kind: 'unplaced-service', service } : undefined;
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

export interface SelectionSummary {
  title: string;
  /** What the node is, for the panel's small heading. */
  kind: string;
  tone: StatusTone;
  stale: boolean;
  statusLabel: string;
  /** Short facts, shared by the hover card and the top of the panel. */
  lines: string[];
}

export function summarizeSelection(selection: TopologySelection): SelectionSummary {
  switch (selection.kind) {
    case 'placement': {
      const { service, instances, clusterName, cluster } = selection;
      const worst = worstInstance(instances);
      const status = describeStatus(worst?.status);
      const { running, total } = summarizeStatuses(instances.map((i) => i.status));
      const problem = worst ? instanceProblem(worst) : undefined;
      return {
        title: service.microservice_name,
        kind: 'Service',
        tone: status.tone,
        stale: !clusterIsReporting(cluster),
        statusLabel: status.label,
        lines: [`${running}/${total} running on ${clusterName}`, ...(problem ? [problem] : [])],
      };
    }
    case 'unplaced-service': {
      const { service } = selection;
      const detail = schedulerDetail(service.status_detail);
      return {
        title: service.microservice_name,
        kind: 'Service',
        tone: notRunningTone(service),
        stale: false,
        statusLabel: notRunningReason(service),
        lines: detail ? [detail] : [],
      };
    }
    case 'cluster': {
      const { cluster, services, name } = selection;
      const state = cluster ? clusterReportState(cluster) : 'reporting';
      const reporting = state === 'reporting';
      const usage = cluster && reporting ? clusterUsageLine(cluster) : undefined;
      return {
        title: name,
        kind: 'Cluster',
        tone: reporting ? 'success' : 'neutral',
        stale: !reporting,
        statusLabel: cluster ? clusterStateLabel(state) : 'Unknown',
        lines: [`${plural(services.length, 'service')} here`, ...(usage ? [usage] : [])],
      };
    }
    case 'unplaced': {
      const abnormal = selection.services.some((s) => isAbnormalTone(notRunningTone(s)));
      return {
        title: 'Not running',
        kind: 'Group',
        tone: abnormal ? 'warning' : 'neutral',
        stale: false,
        statusLabel: abnormal ? 'Needs attention' : 'Idle',
        lines: [`${plural(selection.services.length, 'service')} not running`],
      };
    }
  }
}
