import { clusterReportState, type Cluster, type Service } from '@oakestra/api';
import type { StatusTone } from '@oakestra/ui';
import type { FlowEdge, FlowNode } from '@oakestra/ui/flow';

import {
  compareTones,
  describeStatus,
  isAbnormalTone,
  isPlacementFailure,
  isTransitionalStatus,
  isUndeployed,
  serviceAttention,
  summarizeStatuses,
} from '../services/status';

export const UNPLACED_GROUP_ID = 'unplaced';

export const clusterGroupId = (id: string) => `cluster:${id}`;
export const placementNodeId = (serviceId: string, clusterId: string | null) =>
  `placement:${serviceId}:${clusterId ?? 'none'}`;

export type TopologyNodeRef =
  | { kind: 'cluster'; clusterId: string }
  | { kind: 'placement'; serviceId: string; clusterId: string | null }
  | { kind: 'unplaced' };

/** Reads a node id back into what it stands for; `undefined` for anything this builder never made. */
export function parseTopologyNodeId(id: string): TopologyNodeRef | undefined {
  if (id === UNPLACED_GROUP_ID) return { kind: 'unplaced' };
  const cluster = /^cluster:([^:]+)$/.exec(id);
  if (cluster) return { kind: 'cluster', clusterId: cluster[1]! };
  const placement = /^placement:([^:]+):([^:]+)$/.exec(id);
  if (placement) {
    return {
      kind: 'placement',
      serviceId: placement[1]!,
      clusterId: placement[2] === 'none' ? null : placement[2]!,
    };
  }
  return undefined;
}

/** A cluster that was removed still has instances pointing at it. */
export function clusterDisplayName(clusterId: string, cluster: Cluster | undefined): string {
  return cluster?.cluster_name ?? `Cluster ${clusterId.slice(0, 8)}`;
}

/**
 * The instances of a service that actually run somewhere, by cluster. A cluster that accepted the
 * instance but had no worker for it (NO_WORKER_CAPACITY) runs nothing; drawing it there would claim
 * it does. Such a service ends up under "Not running" with its status as the reason, as in the
 * infrastructure tree.
 */
export function instancesByCluster(service: Service): Map<string, Service['instance_list']> {
  const perCluster = new Map<string, Service['instance_list']>();
  for (const instance of service.instance_list) {
    if (!instance.cluster_id || (!instance.worker_id && isPlacementFailure(instance.status))) {
      continue;
    }
    perCluster.set(instance.cluster_id, [...(perCluster.get(instance.cluster_id) ?? []), instance]);
  }
  return perCluster;
}

/** Above this many caller x target placement pairs, edges are narrowed (see `placementEdges`). */
const MAX_FULL_FAN_OUT = 16;

/** The id the SLA form writes is the target's `_id`; `microserviceID` is what older data used. */
function indexServices(services: readonly Service[]): Map<string, Service> {
  const byId = new Map<string, Service>();
  for (const service of services) byId.set(service._id, service);
  for (const service of services) {
    if (service.microserviceID && !byId.has(service.microserviceID)) {
      byId.set(service.microserviceID, service);
    }
  }
  return byId;
}

/** Service to service links inside the application, without self links and duplicates. */
export function connectivityLinks(services: readonly Service[]): [from: Service, to: Service][] {
  const byId = indexServices(services);
  const links: [Service, Service][] = [];
  for (const service of services) {
    const seen = new Set<string>();
    for (const link of service.connectivity) {
      const target = byId.get(link.target_microservice_id);
      if (!target || target._id === service._id || seen.has(target._id)) continue;
      seen.add(target._id);
      links.push([service, target]);
    }
  }
  return links;
}

interface Placement {
  node: FlowNode;
  service: Service;
  clusterId: string | null;
  running: number;
}

/** The reason a service is not running anywhere, in the words the status badge uses. */
export function notRunningReason(service: Service): string {
  if (isUndeployed(service) && service.status === undefined) return 'Not deployed';
  return describeStatus(service.status).label;
}

export function notRunningTone(service: Service): StatusTone {
  const attention = serviceAttention(service);
  if (attention) return attention.tone;
  return describeStatus(service.status).tone;
}

/**
 * Edges between placements. Every placement of the caller points at every placement of the target,
 * because declared connectivity is between services, not between instances. A service spread over
 * many clusters would make that a thicket, so past MAX_FULL_FAN_OUT pairs each caller placement
 * points only at the target placement in its own cluster, or the first one when there is none.
 */
function placementEdges(from: Placement[], to: Placement[]): [Placement, Placement][] {
  if (from.length * to.length <= MAX_FULL_FAN_OUT) {
    return from.flatMap((a) => to.map((b): [Placement, Placement] => [a, b]));
  }
  return from.map((a) => [a, to.find((b) => b.clusterId === a.clusterId) ?? to[0]!]);
}

/**
 * One frame per cluster that runs part of the application, holding one node per service running
 * there (a service in two clusters appears in both), plus a "Not running" frame for services with
 * no instance anywhere. Arrows are declared connectivity between services, drawn between their
 * placements. No columns are set: the layout orders the frames by the calls between them.
 */
export function buildApplicationTopology(
  services: readonly Service[],
  clusters: readonly Cluster[],
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const sorted = [...services].sort((a, b) =>
    a.microservice_name.localeCompare(b.microservice_name),
  );
  const clusterById = new Map(clusters.map((cluster) => [cluster._id, cluster]));

  const placements = new Map<string, Placement[]>();
  const byCluster = new Map<string, Placement[]>();
  const unplaced: Placement[] = [];

  for (const service of sorted) {
    const perCluster = instancesByCluster(service);
    const own: Placement[] = [];

    for (const [clusterId, instances] of perCluster) {
      const summary = summarizeStatuses(instances.map((instance) => instance.status));
      const [worst = 'neutral'] = instances
        .map((instance) => describeStatus(instance.status).tone)
        .sort(compareTones);
      const placement: Placement = {
        service,
        clusterId,
        running: summary.running,
        node: {
          id: placementNodeId(service._id, clusterId),
          label: service.microservice_name,
          group: clusterGroupId(clusterId),
          tone: worst,
          pulse: instances.some((instance) => isTransitionalStatus(instance.status)),
          // The total is the number of instances on this cluster, so it doubles as the count.
          description: `${summary.running}/${summary.total} running`,
        },
      };
      own.push(placement);
      byCluster.set(clusterId, [...(byCluster.get(clusterId) ?? []), placement]);
    }

    if (own.length === 0) {
      const placement: Placement = {
        service,
        clusterId: null,
        running: 0,
        node: {
          id: placementNodeId(service._id, null),
          label: service.microservice_name,
          group: UNPLACED_GROUP_ID,
          tone: notRunningTone(service),
          pulse:
            isTransitionalStatus(service.status) ||
            service.instance_list.some((instance) => isTransitionalStatus(instance.status)),
          description: notRunningReason(service),
        },
      };
      own.push(placement);
      unplaced.push(placement);
    }
    placements.set(service._id, own);
  }

  const nodes: FlowNode[] = [];
  const groups = [...byCluster]
    .map(([clusterId, members]) => ({
      clusterId,
      members,
      cluster: clusterById.get(clusterId),
    }))
    .map((entry) => ({
      ...entry,
      name: clusterDisplayName(entry.clusterId, entry.cluster),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const { clusterId, members, cluster, name } of groups) {
    const silent = cluster !== undefined && clusterReportState(cluster) !== 'reporting';
    nodes.push({
      id: clusterGroupId(clusterId),
      label: name,
      kind: 'group',
      description: silent
        ? 'Not reporting'
        : `${members.length} ${members.length === 1 ? 'service' : 'services'}`,
      tone: silent ? 'neutral' : undefined,
      stale: silent || undefined,
    });
    nodes.push(...members.map((member) => member.node));
  }

  if (unplaced.length > 0) {
    nodes.push({
      id: UNPLACED_GROUP_ID,
      label: 'Not running',
      kind: 'group',
      description: `${unplaced.length} ${unplaced.length === 1 ? 'service' : 'services'}`,
      tone: unplaced.some((member) => isAbnormalTone(member.node.tone ?? 'neutral'))
        ? 'warning'
        : 'neutral',
    });
    nodes.push(...unplaced.map((member) => member.node));
  }

  const edges: FlowEdge[] = [];
  for (const [from, to] of connectivityLinks(sorted)) {
    for (const [a, b] of placementEdges(
      placements.get(from._id) ?? [],
      placements.get(to._id) ?? [],
    )) {
      edges.push({
        id: `${a.node.id}~${b.node.id}`,
        source: a.node.id,
        target: b.node.id,
        arrow: true,
        animated: a.running > 0 && b.running > 0,
      });
    }
  }

  return { nodes, edges };
}
