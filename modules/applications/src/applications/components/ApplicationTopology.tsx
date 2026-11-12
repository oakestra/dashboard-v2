import type { Application } from '@oakestra/api';
import {
  clustersQuery,
  servicesByApplicationQuery,
  useOakestraApi,
  useSearchParam,
} from '@oakestra/dashboard-sdk';
import { QueryErrorAlert, Skeleton } from '@oakestra/ui';
import { FlowGraph } from '@oakestra/ui/flow';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { buildApplicationTopology } from '../topology';
import { resolveTopologyNode } from '../topology-details';
import { TopologyHoverCard, TopologyInspector } from './TopologyInspector';

/**
 * The application's services grouped by the cluster that runs them. It shares the cache entries of the
 * services list and the cluster queries, so opening the tab costs no request of its own. The
 * selected node lives in `?node=`, so a link restores the panel.
 */
export function ApplicationTopology({ application }: { application: Application }) {
  const api = useOakestraApi();
  const services = useQuery(servicesByApplicationQuery(api, application._id));
  const clusters = useQuery(clustersQuery(api));
  const [nodeId, setNodeId] = useSearchParam('node', '');
  const clearSelection = useCallback(() => setNodeId(''), [setNodeId]);

  const graph = useMemo(() => {
    if (!services.data || !clusters.data) return undefined;
    return buildApplicationTopology(services.data, clusters.data);
  }, [services.data, clusters.data]);

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
      <p className="text-sm text-muted-foreground">
        This application has no services yet, so there is nothing to draw.
      </p>
    );
  }
  const { data: serviceList } = services;
  const { data: clusterList } = clusters;

  return (
    <div className="space-y-2">
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
              services={serviceList}
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
