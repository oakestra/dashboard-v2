import type { Cluster } from '@oakestra/api';
import { useSearchParam } from '@oakestra/dashboard-sdk';
import { SectionCard, Skeleton, StatusDot } from '@oakestra/ui';
import { FlowGraph, type FlowNode } from '@oakestra/ui/flow';
import { useMemo } from 'react';

import { clusterPresentation } from '../lib';
import {
  buildInfrastructureTopology,
  clusterNodeId,
  parseInfraNodeId,
  undrawnWorkers,
  type InfraNodeRef,
} from '../topology';
import {
  clusterHoverLines,
  restHoverLines,
  rootHoverLines,
  summarizeProblems,
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

  const graph = useMemo(
    () => buildInfrastructureTopology(clusters, services, !pending && !failed),
    [clusters, services, pending, failed],
  );
  const { workers } = graph;

  // The URL is user input and the workers arrive late, so an id only counts once it names
  // something that is drawn. Until then it is ignored rather than dropped from the URL.
  const selected = useMemo<InfraNodeRef | null>(() => {
    const ref = parseInfraNodeId(nodeParam);
    if (!ref) return null;
    if (ref.kind === 'root') return ref;
    if (!clusters.some((cluster) => cluster._id === ref.clusterId)) return null;
    // The placeholder stands for no worker, so selecting it means its cluster.
    if (ref.kind === 'rest') return { kind: 'cluster', clusterId: ref.clusterId };
    if (ref.kind === 'worker' && !workers.get(ref.clusterId)?.has(ref.workerId)) return null;
    return ref;
  }, [nodeParam, clusters, workers]);
  const selectedId = !selected
    ? null
    : selected.kind === 'cluster'
      ? clusterNodeId(selected.clusterId)
      : nodeParam;
  const problems = useMemo(() => summarizeProblems(clusters, workers), [clusters, workers]);

  const selectNode = (node: FlowNode) => {
    const ref = parseInfraNodeId(node.id);
    setNodeParam(ref?.kind === 'rest' ? clusterNodeId(ref.clusterId) : node.id);
  };

  const hoverCard = (node: FlowNode) => {
    const ref = parseInfraNodeId(node.id);
    if (!ref) return null;
    if (ref.kind === 'root') {
      return (
        <HoverLines title="Root orchestrator" lines={rootHoverLines(summarizeRoot(clusters))} />
      );
    }
    const cluster = clusters.find((candidate) => candidate._id === ref.clusterId);
    if (!cluster) return null;
    if (ref.kind === 'rest') {
      const { title, lines } = restHoverLines(
        undrawnWorkers(cluster, workers.get(ref.clusterId)?.size ?? 0),
      );
      return <HoverLines title={title} lines={lines} />;
    }
    if (ref.kind === 'cluster') {
      return <HoverLines title={cluster.cluster_name} lines={clusterHoverLines(cluster)} />;
    }
    const entry = workers.get(ref.clusterId)?.get(ref.workerId);
    if (!entry) return null;
    return (
      <HoverLines
        title={workerTitle(ref.workerId)}
        lines={workerHoverLines(entry, clusterPresentation(cluster).stale)}
      />
    );
  };

  return (
    <SectionCard
      title="Topology"
      description="Clusters registered with the root orchestrator and the workers running your instances. Hatched clusters have stopped reporting. Hover for a preview, click for details."
    >
      <div className="space-y-2">
        {problems.length > 0 ? (
          <ul aria-label="Needs attention" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {problems.map((problem) => (
              <li key={problem.id}>
                <button
                  type="button"
                  onClick={() => setNodeParam(problem.nodeId)}
                  className="focus-visible:ring-ring/50 inline-flex items-center gap-2 rounded-sm text-left outline-none hover:underline focus-visible:ring-[3px]"
                >
                  <StatusDot tone={problem.tone} stale={problem.stale} />
                  {problem.text}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <FlowGraph
          ariaLabel="Infrastructure topology"
          direction="TB"
          nodes={graph.nodes}
          edges={graph.edges}
          selectedId={selectedId}
          onNodeClick={selectNode}
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
