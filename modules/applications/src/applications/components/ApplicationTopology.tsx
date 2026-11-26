import type { Application } from '@oakestra/api';
import {
  clustersQuery,
  servicesByApplicationQuery,
  useAddonPath,
  useOakestraApi,
  useSearchParam,
} from '@oakestra/dashboard-sdk';
import { Button, EmptyState, QueryErrorAlert, Skeleton, StatusDot } from '@oakestra/ui';
import { FlowGraph } from '@oakestra/ui/flow';
import { useQuery } from '@tanstack/react-query';
import { NetworkIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Link } from 'react-router';

import { buildApplicationTopology } from '../topology';
import { resolveTopologyNode, topologyProblems, type TopologyProblem } from '../topology-details';
import { TopologyHoverCard, TopologyInspector } from './TopologyInspector';

/**
 * What needs the owner, above the graph. Each item selects the node that explains it. The glyph
 * carries the tone and the text stays neutral, so the row does not compete with the graph.
 */
function ProblemSummary({
  problems,
  onSelect,
}: {
  problems: readonly TopologyProblem[];
  onSelect: (id: string) => void;
}) {
  if (problems.length === 0) return null;
  return (
    <ul aria-label="Needs attention" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {problems.map((problem) => (
        <li key={problem.id}>
          <button
            type="button"
            onClick={() => onSelect(problem.nodeId)}
            className="inline-flex items-center gap-2 rounded-sm text-left outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <StatusDot tone={problem.tone} stale={problem.id === 'silent'} />
            {problem.text}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The application's services grouped by the cluster that runs them. It shares the cache entries of the
 * services list and the cluster queries, so opening the tab costs no request of its own. The
 * selected node lives in `?node=`, so a link restores the panel.
 */
export function ApplicationTopology({ application }: { application: Application }) {
  const api = useOakestraApi();
  const addonPath = useAddonPath();
  const services = useQuery(servicesByApplicationQuery(api, application._id));
  const clusters = useQuery(clustersQuery(api));
  const [nodeId, setNodeId] = useSearchParam('node', '');
  const clearSelection = useCallback(() => setNodeId(''), [setNodeId]);

  const graph = useMemo(() => {
    if (!services.data || !clusters.data) return undefined;
    return buildApplicationTopology(services.data, clusters.data);
  }, [services.data, clusters.data]);

  const problems = useMemo(
    () => (services.data && clusters.data ? topologyProblems(services.data, clusters.data) : []),
    [services.data, clusters.data],
  );

  // Resolved against the data, not just the graph: a stale id in the URL gets no panel.
  const selection = useMemo(
    () =>
      nodeId && services.data && clusters.data
        ? resolveTopologyNode(nodeId, services.data, clusters.data)
        : undefined,
    [nodeId, services.data, clusters.data],
  );

  const failed = services.isError ? services : clusters.isError ? clusters : undefined;
  if (failed) {
    return (
      <QueryErrorAlert
        title="Could not load the topology"
        error={failed.error}
        onRetry={() => void failed.refetch()}
      />
    );
  }
  if (!graph || !services.data || !clusters.data) {
    return <Skeleton className="h-40 w-full" data-testid="topology-loading" />;
  }
  if (services.data.length === 0) {
    return (
      <EmptyState
        icon={<NetworkIcon />}
        title="No services yet"
        description="Add a service to see which clusters run it and what it calls."
        action={
          <Button asChild>
            <Link to={addonPath(application._id, 'services', 'new')}>New service</Link>
          </Button>
        }
      />
    );
  }
  const { data: serviceList } = services;
  const { data: clusterList } = clusters;

  return (
    <div className="space-y-2">
      <ProblemSummary problems={problems} onSelect={setNodeId} />
      <FlowGraph
        ariaLabel={`Topology of ${application.application_name}`}
        nodes={graph.nodes}
        edges={graph.edges}
        direction="LR"
        selectedId={selection ? nodeId : null}
        onNodeClick={(node) => setNodeId(node.id)}
        onBackgroundClick={clearSelection}
        renderHoverCard={(node) => {
          const hovered = resolveTopologyNode(node.id, serviceList, clusterList);
          return hovered ? <TopologyHoverCard selection={hovered} /> : null;
        }}
        inspector={
          selection ? (
            <TopologyInspector
              selection={selection}
              application={application}
              clusters={clusterList}
              onSelect={setNodeId}
              onClose={clearSelection}
            />
          ) : null
        }
        className="w-full rounded-lg border"
      />
      <p className="text-xs text-muted-foreground">
        Frames are clusters, and a service appears in every cluster that runs it. Arrows show
        declared connectivity: who calls whom. Hatched clusters have stopped reporting. Hover for a
        preview, click for details.
      </p>
    </div>
  );
}
