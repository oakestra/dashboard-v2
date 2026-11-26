import {
  compareTones,
  describeStatus,
  isPlacementFailure,
  type Cluster,
  type Instance,
  type Service,
} from '@oakestra/api';
import { formatPercent, plural, type StatusTone } from '@oakestra/ui';
import type { FlowEdge, FlowMeter, FlowNode } from '@oakestra/ui/flow';

import { clusterPresentation, clusterUsage } from './lib';

const ROOT_NODE_ID = 'root';
const CLUSTER_NODE_PREFIX = 'cluster:';

export const UNKNOWN_WORKER = 'unknown';
const WORKER_NODE_PREFIX = 'worker:';
const REST_NODE_PREFIX = 'rest:';

// Worker ids are long hex strings whose tail tells them apart, while a hand-picked short id is
// shown whole. The applications inspector repeats this rule.
export function shortWorker(workerId: string): string {
  return workerId.length > 10 ? workerId.slice(-6) : workerId;
}

export const clusterNodeId = (clusterId: string) => `${CLUSTER_NODE_PREFIX}${clusterId}`;

export const workerNodeId = (clusterId: string, workerId: string) =>
  `${WORKER_NODE_PREFIX}${clusterId}:${workerId}`;

/** The placeholder for the workers of a cluster that no visible instance runs on. */
export const restNodeId = (clusterId: string) => `${REST_NODE_PREFIX}${clusterId}`;

export type InfraNodeRef =
  | { kind: 'root' }
  | { kind: 'cluster'; clusterId: string }
  | { kind: 'worker'; clusterId: string; workerId: string }
  | { kind: 'rest'; clusterId: string };

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
  if (id.startsWith(REST_NODE_PREFIX)) {
    const clusterId = id.slice(REST_NODE_PREFIX.length);
    return clusterId ? { kind: 'rest', clusterId } : null;
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
      const entry = workers.get(workerId) ?? {
        services: new Set<string>(),
        instances: [],
        tone: status.tone,
        pulse: false,
      };
      workers.set(workerId, entry);
      entry.services.add(service.microservice_name);
      entry.instances.push({ service, instance, tone: status.tone });
      entry.tone = worseTone(entry.tone, status.tone);
      entry.pulse ||= status.pulse;
    }
  }
  return result;
}

/** CPU and memory usage of a reporting cluster, for the gauges on its node. */
function clusterMeters(cluster: Cluster): FlowMeter[] {
  const { cpuPercent, memoryPercent } = clusterUsage(cluster);
  const meter = (label: string, value: number | undefined): FlowMeter => ({
    label,
    value: value ?? null,
    valueLabel: value === undefined ? undefined : formatPercent(value, 0),
  });
  return [meter('CPU', cpuPercent), meter('Memory', memoryPercent)];
}

/**
 * The services on a worker, led by the instance count when one service name per instance would
 * hide how much runs there. The count comes first so truncation cuts names, not the number.
 */
export function workerDescription(entry: WorkerEntry): string {
  const names = [...entry.services].sort().join(', ');
  return entry.instances.length > 1 ? `${entry.instances.length} instances: ${names}` : names;
}

/**
 * How many of a reporting cluster's workers are not drawn. A silent or never-reported cluster
 * has no current count, so nothing is missing from the picture.
 */
export function undrawnWorkers(cluster: Cluster, drawn: number): number {
  if (clusterPresentation(cluster).state !== 'reporting') return 0;
  return Math.max(0, (clusterUsage(cluster).activeNodes ?? 0) - drawn);
}

/**
 * A tree of three rows: the root orchestrator, every cluster, and below each cluster the workers
 * that run something. All clusters are drawn, idle, silent or never reported ones too: where
 * nothing runs is part of the picture.
 */
export function buildInfrastructureTopology(
  clusters: readonly Cluster[],
  services: readonly Service[],
  /**
   * False while the services are loading or failed: no worker is drawn then, so a "+N more"
   * placeholder would claim every worker is hidden.
   */
  workersKnown = true,
): {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** The page checks a selected worker against these; returning them saves a second pass. */
  workers: Map<string, Map<string, WorkerEntry>>;
} {
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
    const clusterId = clusterNodeId(cluster._id);
    const onCluster = workers.get(cluster._id);

    // The node has a fixed width and truncates, so the text stays short; the section's note
    // explains why a cluster may show no workers.
    const description = reporting
      ? plural(clusterUsage(cluster).activeNodes ?? 0, 'worker')
      : label;

    nodes.push({
      id: clusterId,
      label: cluster.cluster_name,
      kind: 'item',
      tone,
      stale,
      description,
      column: 1,
      // Only current figures: a silent cluster's last report would read as its load now. Every
      // reporting cluster gets both rows, so the nodes line up and load compares across them.
      ...(reporting ? { meters: clusterMeters(cluster) } : {}),
    });
    edges.push({
      id: `${ROOT_NODE_ID}->${clusterId}`,
      source: ROOT_NODE_ID,
      target: clusterId,
      variant: reporting ? 'solid' : 'dashed',
      animated: reporting,
    });

    for (const [workerId, entry] of onCluster ?? []) {
      const known = workerId !== UNKNOWN_WORKER;
      const id = workerNodeId(cluster._id, workerId);
      nodes.push({
        id,
        label: known ? shortWorker(workerId) : 'Unknown worker',
        kind: 'item',
        // The label is a six-character id, and a row of full-width boxes is mostly whitespace.
        width: 'narrow',
        column: 2,
        tone: entry.tone,
        pulse: entry.pulse,
        // A silent cluster's instances are last known too.
        stale: stale || undefined,
        description: workerDescription(entry),
      });
      edges.push({
        id: `${clusterId}->${id}`,
        source: clusterId,
        target: id,
        variant: stale ? 'dashed' : 'solid',
      });
    }

    const drawn = onCluster?.size ?? 0;
    const hidden = workersKnown ? undrawnWorkers(cluster, drawn) : 0;
    if (hidden > 0) {
      nodes.push({
        id: restNodeId(cluster._id),
        // "+4 more" under no worker at all would ask "more than what?".
        label: drawn === 0 ? plural(hidden, 'worker') : `+${hidden} more`,
        kind: 'compact',
        column: 2,
      });
      edges.push({
        id: `${clusterId}->${restNodeId(cluster._id)}`,
        source: clusterId,
        target: restNodeId(cluster._id),
        variant: 'dashed',
      });
    }
  }
  return { nodes, edges, workers };
}
