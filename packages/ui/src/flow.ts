// Subpath entry, kept out of the root index on purpose: the root is an eager Module Federation
// singleton loaded on every page, and React Flow plus dagre are only needed where a graph renders.
// The entry itself holds just the Suspense wrapper and a lazy import, so importing `FlowGraph`
// costs nothing until a graph is on screen. No React Flow primitives are re-exported: callers
// describe nodes and edges, and the layout and drawing stay an implementation detail.
export {
  FlowGraph,
  LazyFlowGraph,
  type FlowEdge,
  type FlowGraphProps,
  type FlowLinkProps,
  type FlowNode,
  type FlowNodeKind,
  type FlowTone,
} from './components/flow-graph';
