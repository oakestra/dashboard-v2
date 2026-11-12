import {
  compareTones,
  describeStatus,
  isPlacementFailure,
  type Cluster,
  type Instance,
  type Service,
} from '@oakestra/api';
import { plural, type StatusTone } from '@oakestra/ui';
import type { FlowEdge, FlowNode } from '@oakestra/ui/flow';

import { clusterPresentation, clusterUsage } from './lib';

export const ROOT_NODE_ID = 'root';
export const CLUSTER_NODE_PREFIX = 'cluster:';

export const UNKNOWN_WORKER = 'unknown';
export const WORKER_NODE_PREFIX = 'worker:';

// Same rule as the fleet board (modules/fleet/src/graph.ts, `shortWorker`): worker ids are long
// hex strings whose tail tells them apart, while a hand-picked short id is shown whole.
export function shortWorker(workerId: string): string {
  return workerId.length > 10 ? workerId.slice(-6) : workerId;
}

export const clusterNodeId = (clusterId: string) => `${CLUSTER_NODE_PREFIX}${clusterId}`;

export const workerNodeId = (clusterId: string, workerId: string) =>
  `${WORKER_NODE_PREFIX}${clusterId}:${workerId}`;

export type InfraNodeRef =
  | { kind: 'root' }
  | { kind: 'cluster'; clusterId: string }
  | { kind: 'worker'; clusterId: string; workerId: string };

/**
 * Reads a node id back into what it names. The selection lives in the URL, so this also meets ids
 * that never came from the builder: those return null. Cluster ids are hex strings, so the first
 * colon after the prefix ends the cluster id; a worker id keeps whatever follows.
 */
export function parseInfraNodeId(id: string): InfraNodeRef | null {
  if (id === ROOT_NODE_ID) return { kind: 'root' };
  if (id.startsWith(CLUSTER_NODE_PREFIX)) {
    const clusterId = id.slice(CLUSTER_NODE_PREFIX.length);
    return clusterId ? { kind: 'cluster', clusterId } : null;
  }
  if (id.startsWith(WORKER_NODE_PREFIX)) {
    const rest = id.slice(WORKER_NODE_PREFIX.length);
    const split = rest.indexOf(':');
    if (split <= 0 || split === rest.length - 1) return null;
    return { kind: 'worker', clusterId: rest.slice(0, split), workerId: rest.slice(split + 1) };
  }
  return null;
}

export interface WorkerInstance {
  service: Service;
  instance: Instance;
  tone: StatusTone;
}

export interface WorkerEntry {
  services: Set<string>;
  instances: WorkerInstance[];
  tone: StatusTone;
  pulse: boolean;
}

function worseTone(a: StatusTone, b: StatusTone): StatusTone {
  return compareTones(a, b) <= 0 ? a : b;
}

/**
 * Workers seen in instance data, per cluster. The system-manager has no worker list, so a worker
 * without an instance (or one the viewer cannot see) is missing; the cluster's own description
 * still states `active_nodes`. Instances of a cluster id we do not know are dropped: the cluster
 * list is the source of truth for what exists, and a node for a vanished cluster would only
 * confuse.
 */
export function workersByCluster(services: readonly Service[], known: ReadonlySet<string>) {
  const result = new Map<string, Map<string, WorkerEntry>>();
  for (const service of services) {
    for (const instance of service.instance_list) {
      const clusterId = instance.cluster_id;
      if (!clusterId || !known.has(clusterId)) continue;
      // A cluster that took the instance but found no worker for it (NO_WORKER_CAPACITY) has
      // nothing running anywhere; it would show up as an "Unknown worker". The service pages
      // explain that failure, the infrastructure tree only shows what runs.
      if (!instance.worker_id && isPlacementFailure(instance.status)) continue;
      const workerId = instance.worker_id || UNKNOWN_WORKER;
      const workers = result.get(clusterId) ?? new Map<string, WorkerEntry>();
      result.set(clusterId, workers);
      const status = describeStatus(instance.status);
      const first = !workers.has(workerId);
      const entry = workers.get(workerId) ?? {
        services: new Set<string>(),
        instances: [],
        tone: status.tone,
        pulse: false,
      };
      workers.set(workerId, entry);
      entry.services.add(service.microservice_name);
      entry.instances.push({ service, instance, tone: status.tone });
      entry.tone = first ? status.tone : worseTone(entry.tone, status.tone);
      entry.pulse ||= status.pulse;
    }
  }
  return result;
}

/**
 * Root orchestrator, every cluster below it and the workers that run something. Clusters are
 * groups so their workers sit inside them. All clusters are drawn, idle, silent or never reported
 * ones too: where nothing runs is part of the picture.
 */
export function buildInfrastructureTopology(
  clusters: readonly Cluster[],
  services: readonly Service[],
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const sorted = [...clusters].sort((a, b) => a.cluster_name.localeCompare(b.cluster_name));
  const workers = workersByCluster(services, new Set(sorted.map((cluster) => cluster._id)));

  const nodes: FlowNode[] = [
    {
      id: ROOT_NODE_ID,
      label: 'Root orchestrator',
      kind: 'primary',
      description: plural(sorted.length, 'cluster'),
      column: 0,
    },
  ];
  const edges: FlowEdge[] = [];

  for (const cluster of sorted) {
    const { state, label, tone, stale } = clusterPresentation(cluster);
    const reporting = state === 'reporting';
    const groupId = clusterNodeId(cluster._id);
    const onCluster = workers.get(cluster._id);

    // An empty group is only as wide as its header, so the text stays short; the section's note
    // explains why a cluster may show no workers.
    const description = reporting
      ? plural(clusterUsage(cluster).activeNodes ?? 0, 'worker')
      : label;

    nodes.push({
      id: groupId,
      label: cluster.cluster_name,
      kind: 'group',
      tone,
      stale,
      description,
      column: 1,
    });
    edges.push({
      id: `${ROOT_NODE_ID}->${groupId}`,
      source: ROOT_NODE_ID,
      target: groupId,
      variant: reporting ? 'solid' : 'dashed',
      animated: reporting,
    });

    for (const [workerId, entry] of onCluster ?? []) {
      const known = workerId !== UNKNOWN_WORKER;
      nodes.push({
        id: workerNodeId(cluster._id, workerId),
        label: known ? shortWorker(workerId) : 'Unknown worker',
        kind: 'item',
        group: groupId,
        tone: entry.tone,
        pulse: entry.pulse,
        // A silent cluster's instances are last known too.
        stale: stale || undefined,
        description: [...entry.services].sort().join(', '),
      });
    }
  }
  return { nodes, edges };
}
