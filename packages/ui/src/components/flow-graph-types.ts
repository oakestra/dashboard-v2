import type { ReactNode } from 'react';

import type { StatusTone } from './status-badge';

/** The tones of `StatusBadge`, with the same meanings. */
export type FlowTone = StatusTone;

/**
 * - `primary`: the subject of the graph (the application, the service being placed).
 * - `item`: an ordinary node with an optional one-line description.
 * - `group`: a labelled container drawn around the nodes that name it as their `group`.
 * - `compact`: a small pill, for many similar nodes (workers, instances).
 */
export type FlowNodeKind = 'primary' | 'item' | 'group' | 'compact';

export interface FlowNode {
  id: string;
  label: string;
  /** Defaults to `item`. */
  kind?: FlowNodeKind;
  /** Status glyph. Only `warning` and `destructive` also color the node's border. */
  tone?: FlowTone;
  /** Last known state without a recent report: hatched surface and a dashed glyph. */
  stale?: boolean;
  /** Pulses the glyph while the state is changing (off under reduced motion). */
  pulse?: boolean;
  /** One line under the label, e.g. "2/3 running". Ignored on `compact` nodes. */
  description?: string;
  /**
   * Makes the label a link, rendered with `renderLink`. A selectable graph (`onNodeClick`) should
   * usually leave it out: a click on the label then navigates, a click beside it selects, and the
   * two compete. Link from the caller's detail panel instead.
   */
  href?: string;
  /**
   * Id of the enclosing node, which must have kind `group`. One level only: a group cannot sit in
   * another group, and a node naming anything else is drawn at the top level.
   */
  group?: string;
  /**
   * Forces the node into a column (a row with `direction: 'TB'`), counted from 0. Without it the
   * layout derives the column from the edges, so a node without edges lands in the first one. Only
   * read on top-level nodes. Edges that skip columns are routed around the nodes in between; edges
   * within a column or pointing back against the columns do not shape the layout and are drawn as
   * a direct step line.
   */
  column?: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  /** Short tag at the middle of the edge. */
  label?: string;
  /** Stroke color; defaults to `neutral`. */
  tone?: FlowTone;
  /** `dashed` for a weaker or indirect relation. Defaults to `solid`. */
  variant?: 'solid' | 'dashed';
  /** A dot travelling along the edge, for live traffic or work (off under reduced motion). */
  animated?: boolean;
  /** An arrowhead at the target, for a relation with a direction (who calls whom). */
  arrow?: boolean;
}

export interface FlowLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
}

export interface FlowGraphProps {
  nodes: readonly FlowNode[];
  edges: readonly FlowEdge[];
  /** Left to right (default) or top to bottom. */
  direction?: 'LR' | 'TB';
  /**
   * Called on click and on Enter while the node has focus; this is how callers select a node. Not
   * called for clicks on the node's link.
   */
  onNodeClick?: (node: FlowNode) => void;
  /**
   * Gets a visible ring, and while nothing is hovered its connections stay highlighted and the
   * rest fades. When it changes to a node outside the visible part of the frame, the graph pans
   * to it (same zoom).
   */
  selectedId?: string | null;
  /**
   * Called on a click on the empty background, and on Escape inside the graph when no hover card
   * is open. Callers clear their selection here.
   */
  onBackgroundClick?: () => void;
  /**
   * Content of a floating card for a node: shown after the pointer rests on the node for a moment
   * (350 ms), or at once when the node gets keyboard focus. It closes on pointer leave (after a
   * 100 ms grace, so moving to a neighbour does not flicker), blur, Escape, pan and zoom. The card
   * is informational: it takes no pointer events and no focus. Return `null` for no card.
   */
  renderHoverCard?: (node: FlowNode) => ReactNode;
  /**
   * Details of the selection, usually a `Card`. On a frame at least 768px wide it floats over the
   * graph's right edge, so the graph keeps its full width and zoom, and the selected node is panned
   * into the part the panel leaves free. On a narrower frame it renders below the graph. Pass
   * `null` when nothing is selected.
   */
  inspector?: ReactNode;
  /**
   * Renders the link of a node with an `href`. Defaults to a plain anchor; pass the host's router
   * link (`<Link to={href} ...>`) to navigate without a page load.
   */
  renderLink?: (props: FlowLinkProps) => ReactNode;
  /**
   * Width and frame of the graph. Defaults to `w-full overflow-hidden rounded-lg border`. Leave the
   * height out: it follows the graph (its height at the zoom that fits the frame's width, but never
   * below a readable zoom), bounded by `minHeight` and `maxHeight`.
   */
  className?: string;
  /** Lowest frame height in px. Defaults to 160. */
  minHeight?: number;
  /** Highest frame height in px; a taller graph is panned. Defaults to 600. */
  maxHeight?: number;
  /** Names the graph for screen readers. */
  ariaLabel: string;
}
