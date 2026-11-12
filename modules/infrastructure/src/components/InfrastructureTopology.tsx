import type { Cluster } from '@oakestra/api';
import { useSearchParam } from '@oakestra/dashboard-sdk';
import { SectionCard, Skeleton } from '@oakestra/ui';
import { FlowGraph, type FlowNode } from '@oakestra/ui/flow';
import { useMemo } from 'react';

import {
  buildInfrastructureTopology,
  parseInfraNodeId,
  workersByCluster,
  type InfraNodeRef,
} from '../topology';
import {
  clusterHoverLines,
  rootHoverLine,
  summarizeRoot,
  workerHoverLines,
  workerTitle,
} from '../topology-details';
import { useTopologyServices } from '../use-topology-services';
import { TopologyInspector } from './TopologyInspector';

function HoverLines({ title, lines }: { title: string; lines: readonly string[] }) {
  return (
    <>
      <p className="font-medium">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-muted-foreground">
          {line}
        </p>
      ))}
    </>
  );
}

/**
 * The hierarchy of the platform: root orchestrator, clusters, and the workers running the
 * viewer's instances. Hover previews a node, a click selects it and opens its details beside the
 * graph; going to the cluster page is a button there, so a click never navigates by surprise.
 * It reads the same cache entries as the fleet and the applications pages.
 */
export function InfrastructureTopology({ clusters }: { clusters: readonly Cluster[] }) {
  const { services, applicationNames, pending, failed } = useTopologyServices();
  const [nodeParam, setNodeParam] = useSearchParam('node', '');

  const workers = useMemo(
    () => workersByCluster(services, new Set(clusters.map((cluster) => cluster._id))),
    [clusters, services],
  );
  const graph = useMemo(
    () => buildInfrastructureTopology(clusters, services),
    [clusters, services],
  );

  // The URL is user input and the workers arrive late, so an id only counts once it names
  // something that is drawn. Until then it is ignored rather than dropped from the URL.
  const selected = useMemo<InfraNodeRef | null>(() => {
    const ref = parseInfraNodeId(nodeParam);
    if (!ref) return null;
    if (ref.kind === 'root') return ref;
    if (!clusters.some((cluster) => cluster._id === ref.clusterId)) return null;
    if (ref.kind === 'worker' && !workers.get(ref.clusterId)?.has(ref.workerId)) return null;
    return ref;
  }, [nodeParam, clusters, workers]);
  const selectedId = selected ? nodeParam : null;

  const hoverCard = (node: FlowNode) => {
    const ref = parseInfraNodeId(node.id);
    if (!ref) return null;
    if (ref.kind === 'root') {
      return (
        <HoverLines title="Root orchestrator" lines={[rootHoverLine(summarizeRoot(clusters))]} />
      );
    }
    const cluster = clusters.find((candidate) => candidate._id === ref.clusterId);
    if (!cluster) return null;
    if (ref.kind === 'cluster') {
      return <HoverLines title={cluster.cluster_name} lines={clusterHoverLines(cluster)} />;
    }
    const entry = workers.get(ref.clusterId)?.get(ref.workerId);
    if (!entry) return null;
    return (
      <HoverLines
        title={workerTitle(ref.workerId)}
        lines={workerHoverLines(entry, cluster.cluster_name)}
      />
    );
  };

  return (
    <SectionCard
      title="Topology"
      description="Clusters registered with the root orchestrator and the workers running your instances. Hatched clusters have stopped reporting. Hover for a preview, click for details."
    >
      <div className="space-y-2">
        <FlowGraph
          ariaLabel="Infrastructure topology"
          direction="TB"
          nodes={graph.nodes}
          edges={graph.edges}
          selectedId={selectedId}
          onNodeClick={(node) => setNodeParam(node.id)}
          onBackgroundClick={() => setNodeParam('')}
          renderHoverCard={hoverCard}
          inspector={
            selected ? (
              <TopologyInspector
                target={selected}
                clusters={clusters}
                workers={workers}
                applicationNames={applicationNames}
                onSelect={setNodeParam}
                onClose={() => setNodeParam('')}
              />
            ) : null
          }
          className="w-full rounded-lg border"
        />
        {pending ? (
          <Skeleton className="h-4 w-48" data-testid="topology-workers-loading" />
        ) : failed ? (
          <p role="status" className="text-muted-foreground text-xs">
            Workers are not shown: the services could not be loaded.
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Workers appear once an instance you can see runs on them; idle workers are not listed.
          </p>
        )}
      </div>
    </SectionCard>
  );
}
