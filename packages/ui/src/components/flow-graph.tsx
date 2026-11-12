import { lazy, Suspense } from 'react';

import type { FlowGraphProps } from './flow-graph-types';
import { Skeleton } from './skeleton';

export type {
  FlowEdge,
  FlowGraphProps,
  FlowLinkProps,
  FlowNode,
  FlowNodeKind,
  FlowTone,
} from './flow-graph-types';

// React Flow and dagre are only needed by pages that draw a graph.
export const LazyFlowGraph = lazy(() => import('./flow-graph-impl'));

/** Suspense-wrapped lazy graph: nodes laid out with dagre, drawn with React Flow. */
export function FlowGraph(props: FlowGraphProps) {
  return (
    <Suspense
      fallback={
        <Skeleton
          className={props.className ?? 'w-full rounded-lg'}
          style={{ height: props.minHeight ?? 160 }}
        />
      }
    >
      <LazyFlowGraph {...props} />
    </Suspense>
  );
}
