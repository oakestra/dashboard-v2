import type { Service } from '@oakestra/api';
import { FlowGraph, type FlowEdge, type FlowNode } from '@oakestra/ui/flow';
import { useMemo } from 'react';

import type { PlacementBlocker, PlacementRow } from '../placement';

const BLOCKER_TAGS: Record<PlacementBlocker, string> = {
  target: 'target',
  runtime: 'runtime',
  vcpus: 'vCPU',
  memory: 'memory',
  csi: 'CSI',
};

const SERVICE_ID = 'service';
const clusterId = (id: string) => `cluster:${id}`;

/** Pure so tests can check it without rendering the lazy graph. */
export function buildPlacementGraph(
  service: Pick<Service, 'microservice_name'>,
  rows: readonly PlacementRow[],
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [
    { id: SERVICE_ID, label: service.microservice_name, kind: 'primary', column: 0 },
  ];
  const edges: FlowEdge[] = [];
  for (const row of rows) {
    const id = clusterId(row.cluster._id);
    nodes.push({
      id,
      label: row.cluster.cluster_name,
      kind: 'compact',
      column: 1,
      stale: row.state === 'silent' || undefined,
      tone: row.state === 'passes' ? 'success' : row.state === 'blocked' ? 'warning' : 'neutral',
    });
    const edge = { id: `${SERVICE_ID}>${id}`, source: SERVICE_ID, target: id };
    if (row.state === 'silent') edges.push({ ...edge, tone: 'neutral', variant: 'dashed' });
    else if (row.state === 'passes') edges.push({ ...edge, tone: 'success' });
    else {
      const [first] = row.blockers;
      // Warning, like the checklist's "Blocked by" badges: a blocked cluster is a mismatch with
      // the service's limits, not a failure of the cluster.
      edges.push({
        ...edge,
        tone: 'warning',
        label: first ? BLOCKER_TAGS[first] : undefined,
      });
    }
  }
  return { nodes, edges };
}

/**
 * The checklist below it says the same in words. The layout only re-runs when the clusters change,
 * so dragging a slider recolors the edges in place instead of moving anything.
 */
export function PlacementDiagram({
  service,
  rows,
}: {
  service: Pick<Service, 'microservice_name'>;
  rows: readonly PlacementRow[];
}) {
  const { nodes, edges } = useMemo(() => buildPlacementGraph(service, rows), [service, rows]);
  if (rows.length === 0) return null;
  return (
    <div className="px-4 pb-3">
      <FlowGraph
        ariaLabel={`Which clusters could host ${service.microservice_name}`}
        nodes={nodes}
        edges={edges}
        direction="LR"
        className="w-full rounded-lg border"
      />
    </div>
  );
}
