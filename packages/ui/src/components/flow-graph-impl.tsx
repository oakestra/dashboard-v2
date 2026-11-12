import '@xyflow/react/dist/base.css';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Handle,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
} from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion';
import { cn } from '../lib/utils';
import type {
  FlowEdge,
  FlowGraphProps,
  FlowLinkProps,
  FlowNode,
  FlowTone,
} from './flow-graph-types';
import {
  layoutGraph,
  layoutKey,
  roundedPath,
  type FlowDirection,
  type GraphLayout,
  type EdgeRoute,
} from './flow-layout';
import { FlowHoverCard } from './flow-hover-card';
import { fitViewport, type ViewportFit } from './flow-viewport';
import { StatusDot, staleSurfaceClassName } from './status-badge';

interface NodeData extends Record<string, unknown> {
  node: FlowNode;
  direction: FlowDirection;
  selected: boolean;
  clickable: boolean;
  /** Another node is hovered and this one is not connected to it. */
  dimmed: boolean;
  reducedMotion: boolean;
  renderLink: (props: FlowLinkProps) => ReactNode;
}

interface EdgeData extends Record<string, unknown> {
  edge: FlowEdge;
  moving: boolean;
  /** A node is hovered: `true` fades this edge, `false` (touching the node) draws it stronger. */
  dimmed: boolean | null;
  /** The route from the layout; without one the edge is drawn as a direct step line. */
  route: EdgeRoute | undefined;
}

type ItemNode = Node<NodeData, 'flowItem'>;
type GroupNode = Node<NodeData, 'flowGroup'>;
type ToneEdge = Edge<EdgeData, 'flowEdge'>;

const CONTROLS_MIN_WIDTH = 480;
// Below this frame width a floating panel would cover most of the graph; it goes below instead.
const INSPECTOR_OVERLAY_MIN_WIDTH = 768;
const INSPECTOR_WIDTH = 320;
const INSPECTOR_INSET = 12;
const INSPECTOR_MIN_FRAME_HEIGHT = 440;
/** Height of the controls row plus its margin. */
const CONTROLS_INSET = 44;

// The fit button shows the whole graph, however small; the frame itself settles on a readable
// zoom (see fitViewport). Never past 1: three nodes would otherwise fill the frame with huge boxes.
const FIT_VIEW_OPTIONS = { padding: 0.15, maxZoom: 1 };
const FIT_DURATION_MS = 250;

/** Hover long enough to mean it before a card opens; a short grace keeps it while moving on. */
export const HOVER_CARD_DELAY_MS = 350;
export const HOVER_CARD_GRACE_MS = 100;

// Only warning and destructive color a node, so a healthy graph stays neutral (see the Styling
// rules); the glyph carries every other tone.
const NODE_TONE_CLASSES: Partial<Record<FlowTone, string>> = {
  warning: 'border-warning/60',
  destructive: 'border-destructive/60',
};

// SVG strokes are set inline: base.css styles `.react-flow__edge-path` unlayered, which would beat
// any utility class. Success and info are softened so that a fully healthy graph stays calm.
const EDGE_STROKES: Record<FlowTone, string> = {
  success: 'color-mix(in oklab, var(--success) 65%, transparent)',
  info: 'color-mix(in oklab, var(--info) 65%, transparent)',
  warning: 'var(--warning)',
  destructive: 'var(--destructive)',
  neutral: 'color-mix(in oklab, var(--muted-foreground) 45%, transparent)',
};

const EDGE_LABEL_TONE_CLASSES: Partial<Record<FlowTone, string>> = {
  warning: 'border-warning/40 text-warning',
  destructive: 'border-destructive/40 text-destructive',
};

// Edges attach to invisible handles; nothing here can be connected by hand.
const HANDLE_STYLE: CSSProperties = { opacity: 0, border: 0 };

function NodeHandles({ direction }: { direction: FlowDirection }) {
  return (
    <>
      <Handle
        type="target"
        position={direction === 'LR' ? Position.Left : Position.Top}
        isConnectable={false}
        style={HANDLE_STYLE}
      />
      <Handle
        type="source"
        position={direction === 'LR' ? Position.Right : Position.Bottom}
        isConnectable={false}
        style={HANDLE_STYLE}
      />
    </>
  );
}

function NodeLabel({ data, className }: { data: NodeData; className?: string }) {
  const { node, renderLink } = data;
  if (!node.href) {
    return (
      <span className={cn('truncate', className)} title={node.label}>
        {node.label}
      </span>
    );
  }
  // `data-flow-link` keeps a click on the link from also counting as a click on the node, and
  // `nopan` keeps a press on it from starting a pan.
  return (
    <span data-flow-link className={cn('nopan min-w-0 truncate', className)} title={node.label}>
      {renderLink({
        href: node.href,
        className:
          'rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50',
        children: node.label,
      })}
    </span>
  );
}

function nodeSurface(data: NodeData) {
  const { node, selected, clickable, dimmed } = data;
  return cn(
    'size-full border bg-card text-card-foreground shadow-xs motion-safe:transition-[opacity,border-color]',
    node.stale
      ? ['border-dashed text-muted-foreground', staleSurfaceClassName]
      : NODE_TONE_CLASSES[node.tone ?? 'neutral'],
    selected && 'outline-2 outline-offset-2 outline-primary',
    (clickable || node.href) && 'hover:border-foreground/30',
    clickable && 'cursor-pointer',
    dimmed && 'opacity-40',
  );
}

function Glyph({ data }: { data: NodeData }) {
  const { node, reducedMotion } = data;
  if (!node.tone && !node.stale) return null;
  return (
    <StatusDot
      tone={node.tone ?? 'neutral'}
      stale={node.stale ?? false}
      pulse={!reducedMotion && (node.pulse ?? false)}
    />
  );
}

function ItemNodeView({ data }: NodeProps<ItemNode>) {
  const kind = data.node.kind ?? 'item';
  const description = kind === 'compact' ? undefined : data.node.description;
  return (
    <div
      data-slot="flow-node"
      data-kind={kind}
      data-tone={data.node.tone}
      className={cn(
        nodeSurface(data),
        'flex items-center',
        kind === 'compact' ? 'gap-1.5 rounded-full px-3 text-xs' : 'gap-2 rounded-lg px-3 text-sm',
        kind === 'primary' && 'gap-2.5 px-4',
      )}
    >
      <NodeHandles direction={data.direction} />
      <Glyph data={data} />
      <div className="flex min-w-0 flex-1 flex-col">
        <NodeLabel data={data} className={kind === 'primary' ? 'font-semibold' : 'font-medium'} />
        {description ? (
          <span className="truncate text-xs text-muted-foreground" title={description}>
            {description}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function GroupNodeView({ data }: NodeProps<GroupNode>) {
  const { description } = data.node;
  return (
    <div
      data-slot="flow-node"
      data-kind="group"
      data-tone={data.node.tone}
      className={cn(nodeSurface(data), 'rounded-lg bg-muted/40')}
    >
      <NodeHandles direction={data.direction} />
      {/* h-9 matches GROUP_HEADER in flow-layout.ts, which reserves the room for this row. */}
      <div className="flex h-9 items-center gap-2 px-3 text-sm">
        <Glyph data={data} />
        <NodeLabel data={data} className="font-medium" />
        {description ? (
          <span className="ml-auto truncate text-xs text-muted-foreground" title={description}>
            {description}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const ARROW_LENGTH = 7;
const ARROW_HALF_WIDTH = 4;

/**
 * A filled triangle whose tip sits on the target handle, pointing along the edge's last stretch.
 * Drawn as a path rather than an SVG marker: marker ids would be DOM ids shared between graphs, and
 * a marker cannot take its fill from the CSS variables the strokes use.
 */
export function arrowHead(
  points: readonly { x: number; y: number }[] | null,
  target: { x: number; y: number },
  targetPosition: Position,
): string {
  let tip = target;
  let dx: number;
  let dy: number;
  const last = points?.at(-1);
  const before = points?.at(-2);
  if (last && before) {
    tip = last;
    dx = last.x - before.x;
    dy = last.y - before.y;
  } else {
    // A step line always enters through the handle's side.
    const inward: Record<Position, [number, number]> = {
      [Position.Left]: [1, 0],
      [Position.Right]: [-1, 0],
      [Position.Top]: [0, 1],
      [Position.Bottom]: [0, -1],
    };
    [dx, dy] = inward[targetPosition];
  }
  const length = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / length, dy / length];
  const baseX = tip.x - ux * ARROW_LENGTH;
  const baseY = tip.y - uy * ARROW_LENGTH;
  const [px, py] = [-uy * ARROW_HALF_WIDTH, ux * ARROW_HALF_WIDTH];
  return `M ${tip.x} ${tip.y} L ${baseX + px} ${baseY + py} L ${baseX - px} ${baseY - py} Z`;
}

function ToneEdgeView({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<ToneEdge>) {
  const route = data?.route;
  const [path, labelX, labelY] =
    route && route.points.length > 1
      ? [roundedPath(route.points), route.label.x, route.label.y]
      : getSmoothStepPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
          borderRadius: 8,
        });
  const edge = data?.edge;
  const tone = edge?.tone ?? 'neutral';
  const dimmed = data?.dimmed === true;
  const head = edge?.arrow
    ? arrowHead(
        route && route.points.length > 1 ? route.points : null,
        { x: targetX, y: targetY },
        targetPosition,
      )
    : null;
  return (
    <>
      {/* No `id`: it would become a DOM id, and two graphs on a page can share edge ids. */}
      <BaseEdge
        path={path}
        style={{
          stroke: EDGE_STROKES[tone],
          strokeWidth: data?.dimmed === false ? 2.25 : 1.5,
          opacity: dimmed ? 0.15 : 1,
          transition: 'opacity 150ms, stroke-width 150ms',
          ...(edge?.variant === 'dashed' ? { strokeDasharray: '5 4' } : {}),
        }}
      />
      {head ? (
        <path
          d={head}
          fill={EDGE_STROKES[tone]}
          stroke="none"
          style={{ opacity: dimmed ? 0.15 : 1, transition: 'opacity 150ms' }}
          aria-hidden
        />
      ) : null}
      {/* React Flow's own `animated` marches dashes along the edge, which would look exactly like
          the `dashed` variant. A dot travelling along a solid line keeps the two apart. */}
      {data?.moving && !dimmed ? (
        <circle r={2.5} fill={EDGE_STROKES[tone]} aria-hidden>
          <animateMotion dur="2.4s" repeatCount="indefinite" path={path} />
        </circle>
      ) : null}
      {edge?.label ? (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            className={cn(
              'absolute max-w-40 truncate rounded-sm border bg-card px-1.5 py-0.5 text-[0.625rem] leading-3 text-muted-foreground',
              EDGE_LABEL_TONE_CLASSES[tone],
              dimmed && 'opacity-30',
            )}
          >
            {edge.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const NODE_TYPES = { flowItem: ItemNodeView, flowGroup: GroupNodeView };
const EDGE_TYPES = { flowEdge: ToneEdgeView };

function DefaultLink({ href, className, children, 'aria-label': ariaLabel }: FlowLinkProps) {
  return (
    <a href={href} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  );
}

/** Lays out again only when the structure changes (see `layoutKey`), never on a status update. */
function useStableLayout(
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
  direction: FlowDirection,
): { key: string; layout: GraphLayout } {
  const key = layoutKey(nodes, edges, direction);
  const [state, setState] = useState(() => ({
    key,
    layout: layoutGraph(nodes, edges, direction),
  }));
  if (state.key === key) return state;
  const next = { key, layout: layoutGraph(nodes, edges, direction) };
  setState(next);
  return next;
}

/** Width of the frame, 0 until measured (and always in jsdom, which has no layout). */
function useFrameWidth() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, width, element] as const;
}

/** Absolute box of a laid-out node (children are stored relative to their group). */
function absoluteBox(layout: GraphLayout, id: string) {
  const box = layout.nodes.get(id);
  if (!box) return undefined;
  const parent = box.parent ? layout.nodes.get(box.parent) : undefined;
  return { ...box, x: box.x + (parent?.x ?? 0), y: box.y + (parent?.y ?? 0) };
}

/**
 * Moves the camera whenever the fit changes, which happens on a structural change or when the
 * frame gets narrower or wider (a sheet opening next to the page, a phone turning). Never on a
 * status update, since the layout and thus the fit stay the same. Without animation: a resize
 * fires many times in a row, and a camera that glides after every one of them would lag behind.
 *
 * A selected node outside the visible part (a selection restored from the URL on a phone, where
 * the frame shows only the first columns) is panned into view at the same zoom.
 */
function CameraController({
  fit,
  layout,
  selectedId,
  frameWidth,
  coveredRight,
  animate,
}: {
  fit: ViewportFit;
  layout: GraphLayout;
  selectedId: string | null;
  frameWidth: number;
  /** Px on the right that a floating panel hides; the selection is kept clear of them. */
  coveredRight: number;
  animate: boolean;
}) {
  const { setViewport, getViewport } = useReactFlow();
  const { x, y, zoom, height } = fit;

  const revealSelected = useCallback(
    (duration: number) => {
      const box = selectedId ? absoluteBox(layout, selectedId) : undefined;
      if (!box || frameWidth === 0) return;
      const viewport = getViewport();
      const left = box.x * viewport.zoom + viewport.x;
      const top = box.y * viewport.zoom + viewport.y;
      const right = left + box.width * viewport.zoom;
      const bottom = top + box.height * viewport.zoom;
      const visibleWidth = Math.max(frameWidth - coveredRight, frameWidth / 2);
      if (left >= 0 && top >= 0 && right <= visibleWidth && bottom <= height) return;
      void setViewport(
        {
          x: visibleWidth / 2 - (box.x + box.width / 2) * viewport.zoom,
          y: height / 2 - (box.y + box.height / 2) * viewport.zoom,
          zoom: viewport.zoom,
        },
        { duration },
      );
    },
    [selectedId, layout, frameWidth, coveredRight, height, getViewport, setViewport],
  );

  useEffect(() => {
    void setViewport({ x, y, zoom });
    revealSelected(0);
    // Only on a new fit; a new selection is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y, zoom, setViewport]);

  useEffect(() => {
    revealSelected(animate ? FIT_DURATION_MS : 0);
    // Only when the selection or the panel changes, not on every new fit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, coveredRight]);

  return null;
}

/**
 * Which node has a hover card: opens after a delay, closes after a short grace, and switches at
 * once while a card is already open, so moving along a row of nodes reads like one card.
 */
function useHoverCard() {
  const [cardId, setCardId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const open = cardId !== null;
  const show = useCallback(
    (id: string, immediately = false) => {
      clearTimeout(timer.current);
      if (immediately || open) setCardId(id);
      else timer.current = setTimeout(() => setCardId(id), HOVER_CARD_DELAY_MS);
    },
    [open],
  );
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCardId(null), HOVER_CARD_GRACE_MS);
  }, []);
  const close = useCallback(() => {
    clearTimeout(timer.current);
    setCardId(null);
  }, []);
  return { cardId, show, hide, close };
}

const isNodeElement = (target: EventTarget) =>
  target instanceof HTMLElement && target.classList.contains('react-flow__node');

function matchesFocusVisible(element: HTMLElement) {
  try {
    return element.matches(':focus-visible');
  } catch {
    // Engines without the selector (older jsdom): treat focus as keyboard focus.
    return true;
  }
}

export default function FlowGraphImpl({
  nodes,
  edges,
  direction = 'LR',
  onNodeClick,
  selectedId = null,
  renderLink = DefaultLink,
  className,
  ariaLabel,
  minHeight = 160,
  maxHeight = 600,
  renderHoverCard,
  onBackgroundClick,
  inspector,
}: FlowGraphProps) {
  const reducedMotion = usePrefersReducedMotion();
  const { layout } = useStableLayout(nodes, edges, direction);
  const [frameRef, frameWidth, frameElement] = useFrameWidth();
  const hasInspector = inspector !== null && inspector !== undefined && inspector !== false;
  // Unmeasured (0) counts as wide, as in tests.
  const inspectorOverlay =
    hasInspector && (frameWidth === 0 || frameWidth >= INSPECTOR_OVERLAY_MIN_WIDTH);
  // A phone-sized frame is only a few rows tall, and the buttons would cover the first nodes; pinch
  // and drag do the same there. Unmeasured (0) keeps them, as in tests.
  const showControls = frameWidth === 0 || frameWidth >= CONTROLS_MIN_WIDTH;
  const fit = useMemo(
    () =>
      fitViewport(layout, frameWidth, {
        // A floating panel needs room for a few facts before it has to scroll.
        minHeight: inspectorOverlay ? Math.max(minHeight, INSPECTOR_MIN_FRAME_HEIGHT) : minHeight,
        maxHeight: Math.max(maxHeight, inspectorOverlay ? INSPECTOR_MIN_FRAME_HEIGHT : 0),
        // The zoom buttons sit over the bottom left corner; keep the graph clear of them.
        bottomInset: showControls ? CONTROLS_INSET : 0,
      }),
    [layout, frameWidth, minHeight, maxHeight, showControls, inspectorOverlay],
  );
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  // Hovering a node traces it: its edges and neighbours stay, the rest fades. In a dense graph
  // that is the quickest way to follow one node to everything it touches. Without a hover, the
  // selection is traced, so a selected node keeps its connections highlighted.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const tracedId =
    hoveredId ?? (selectedId !== null && layout.nodes.has(selectedId) ? selectedId : null);
  const trace = useMemo(() => {
    const hoveredId = tracedId;
    if (!hoveredId || !layout.nodes.has(hoveredId)) return null;
    const parentOf = (id: string) => layout.nodes.get(id)?.parent;
    // A group counts as its children too, and a child as part of its group.
    const touches = (id: string) => id === hoveredId || parentOf(id) === hoveredId;
    const edgeIds = new Set<string>();
    const nodeIds = new Set<string>([hoveredId]);
    for (const [id, box] of layout.nodes) if (box.parent === hoveredId) nodeIds.add(id);
    const hoveredParent = parentOf(hoveredId);
    if (hoveredParent) nodeIds.add(hoveredParent);
    for (const edge of edges) {
      if (!touches(edge.source) && !touches(edge.target)) continue;
      edgeIds.add(edge.id);
      for (const end of [edge.source, edge.target]) {
        nodeIds.add(end);
        const parent = parentOf(end);
        if (parent) nodeIds.add(parent);
      }
    }
    return { nodeIds, edgeIds };
  }, [tracedId, layout, edges]);

  const hoverCard = useHoverCard();
  const cardNode = hoverCard.cardId ? byId.get(hoverCard.cardId) : undefined;
  const cardContent = cardNode && renderHoverCard ? renderHoverCard(cardNode) : null;

  const flowNodes = useMemo(() => {
    const placed = nodes.flatMap((node) => {
      const box = layout.nodes.get(node.id);
      if (!box) return [];
      const kind = node.kind ?? 'item';
      const data: NodeData = {
        node,
        direction,
        selected: node.id === selectedId,
        clickable: Boolean(onNodeClick),
        dimmed: trace !== null && !trace.nodeIds.has(node.id),
        reducedMotion,
        renderLink,
      };
      const flowNode: ItemNode | GroupNode = {
        id: node.id,
        type: kind === 'group' ? 'flowGroup' : 'flowItem',
        position: { x: box.x, y: box.y },
        width: box.width,
        height: box.height,
        data,
        ...(box.parent ? { parentId: box.parent } : {}),
        ariaLabel: node.description ? `${node.label}, ${node.description}` : node.label,
      };
      return [flowNode];
    });
    // React Flow needs every parent before its children.
    return [
      ...placed.filter((node) => node.type === 'flowGroup'),
      ...placed.filter((node) => node.type !== 'flowGroup'),
    ];
  }, [nodes, layout, direction, selectedId, onNodeClick, reducedMotion, renderLink, trace]);

  const flowEdges = useMemo(
    () =>
      edges
        .filter((edge) => layout.nodes.has(edge.source) && layout.nodes.has(edge.target))
        .map((edge): ToneEdge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'flowEdge',
          data: {
            edge,
            moving: Boolean(edge.animated) && !reducedMotion,
            dimmed: trace ? !trace.edgeIds.has(edge.id) : null,
            route: layout.edges.get(edge.id),
          },
        })),
    [edges, layout, reducedMotion, trace],
  );

  const handleNodeClick: NodeMouseHandler = (event, flowNode) => {
    if (!onNodeClick || (event.target as Element).closest('[data-flow-link]')) return;
    const node = byId.get(flowNode.id);
    if (node) onNodeClick(node);
  };

  // React Flow only knows Enter as "select", and selection is off here, so Enter on a focused node
  // is picked up as it bubbles. A focused link inside the node is left to handle Enter itself.
  // Escape closes an open card first, and clears the selection after.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (hoverCard.cardId) hoverCard.close();
      else onBackgroundClick?.();
      return;
    }
    if (event.key !== 'Enter' || !onNodeClick) return;
    const target = event.target as HTMLElement;
    if (!target.classList.contains('react-flow__node')) return;
    const node = byId.get(target.dataset.id ?? '');
    if (!node) return;
    event.preventDefault();
    onNodeClick(node);
  };

  // Keyboard focus on a node shows its card at once; a click focuses the node too, but then the
  // pointer already drives the card.
  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!isNodeElement(target) || !matchesFocusVisible(target)) return;
    const id = target.dataset.id;
    if (id) hoverCard.show(id, true);
  };
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (isNodeElement(event.target)) hoverCard.hide();
  };

  const graph = (
    // The handlers only listen to events bubbling up from the focusable nodes inside.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="group"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      // React Flow layers its panes and controls with z-indexes; a new stacking context keeps them
      // below the app's dialogs and popovers.
      // `overflow-hidden` always: callers set the frame's radius, and the pane must not paint past it.
      className={cn('relative isolate overflow-hidden', className ?? 'w-full rounded-lg border')}
    >
      {/* Measured on an inner element, so the frame's border does not count. */}
      <div ref={frameRef} style={{ height: fit.height }}>
        <ReactFlow<ItemNode | GroupNode, ToneEdge>
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={(_event, flowNode) => {
            setHoveredId(flowNode.id);
            if (renderHoverCard) hoverCard.show(flowNode.id);
          }}
          onNodeMouseLeave={() => {
            setHoveredId(null);
            hoverCard.hide();
          }}
          onPaneMouseLeave={() => {
            setHoveredId(null);
            hoverCard.hide();
          }}
          onPaneClick={() => onBackgroundClick?.()}
          // A card pinned to a node that slides away under a pan or zoom looks broken; it comes back
          // on the next hover.
          onMoveStart={(event) => {
            if (event) hoverCard.close();
          }}
          defaultViewport={{ x: fit.x, y: fit.y, zoom: fit.zoom }}
          minZoom={0.2}
          maxZoom={2}
          // The layout is computed, so nothing is dragged, connected or selected by hand; the
          // caller's `selectedId` is the only selection.
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          // The graph sits in a scrolling page. A wheel over it scrolls the page, as it would over
          // any other card; zoom is on the controls and pinch, and a drag pans. Double click is off
          // because it zooms when someone double clicks a node to open it.
          zoomOnScroll={false}
          panOnScroll={false}
          preventScrolling={false}
          zoomOnDoubleClick={false}
          ariaLabelConfig={{
            'node.a11yDescription.default': onNodeClick ? 'Press enter for details.' : '',
            'node.a11yDescription.keyboardDisabled': '',
            'edge.a11yDescription.default': '',
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color="color-mix(in oklab, var(--muted-foreground) 25%, transparent)"
          />
          {/* In a row: the frame is often flat, and a column of three buttons would fill it. */}
          {showControls ? (
            <Controls
              orientation="horizontal"
              showInteractive={false}
              fitViewOptions={{
                ...FIT_VIEW_OPTIONS,
                duration: reducedMotion ? 0 : FIT_DURATION_MS,
              }}
            />
          ) : null}
          <CameraController
            fit={fit}
            layout={layout}
            selectedId={selectedId}
            frameWidth={frameWidth}
            coveredRight={inspectorOverlay ? INSPECTOR_WIDTH + 2 * INSPECTOR_INSET : 0}
            animate={!reducedMotion}
          />
        </ReactFlow>
      </div>
      {inspectorOverlay ? (
        // Sized to its content and scrolling past the frame's height; `z-10` lifts it over the
        // panes and controls React Flow layers inside the frame's stacking context.
        <div
          className="absolute z-10 overflow-y-auto rounded-xl shadow-md"
          style={{
            top: INSPECTOR_INSET,
            right: INSPECTOR_INSET,
            width: INSPECTOR_WIDTH,
            maxHeight: `calc(100% - ${2 * INSPECTOR_INSET}px)`,
          }}
        >
          {inspector}
        </div>
      ) : null}
      {hoverCard.cardId && cardContent !== null && cardContent !== undefined ? (
        <FlowHoverCard
          frame={frameElement}
          nodeId={hoverCard.cardId}
          // Away from where the graph continues: below in a left to right graph, beside in a top
          // to bottom one, so the card covers the node's own column rather than the next one.
          side={direction === 'LR' ? 'bottom' : 'right'}
          reducedMotion={reducedMotion}
          onClose={hoverCard.close}
        >
          {cardContent}
        </FlowHoverCard>
      ) : null}
    </div>
  );
  if (!hasInspector || inspectorOverlay) return graph;
  return (
    <div className="space-y-3">
      {graph}
      {inspector}
    </div>
  );
}
