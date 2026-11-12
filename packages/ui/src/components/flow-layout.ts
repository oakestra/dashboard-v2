import dagre, { type EdgeLabel, type Graph, type GraphLabel, type NodeLabel } from '@dagrejs/dagre';

import type { FlowEdge, FlowNode, FlowNodeKind } from './flow-graph-types';

export type FlowDirection = 'LR' | 'TB';

/**
 * Fixed sizes per kind. The layout never measures text: a size that followed the label would move
 * the graph whenever a label changed, and labels truncate instead.
 */
export const NODE_SIZE: Readonly<Record<Exclude<FlowNodeKind, 'group'>, Size>> = {
  primary: { width: 224, height: 64 },
  item: { width: 192, height: 56 },
  compact: { width: 136, height: 32 },
};

/** Inner padding of a group and the height of its title row. */
export const GROUP_PADDING = 16;
export const GROUP_HEADER = 36;
// As wide as a group holding one item, so an empty group's title and description fit and a row of
// groups lines up whether they hold something or not.
const EMPTY_GROUP: Size = {
  width: 192 + 2 * GROUP_PADDING,
  height: GROUP_HEADER + GROUP_PADDING + 8,
};

const SPACING: Readonly<Record<FlowDirection, { nodesep: number; ranksep: number }>> = {
  // Wider gaps left to right, where edge labels sit on the last stretch into the target.
  LR: { nodesep: 24, ranksep: 112 },
  TB: { nodesep: 24, ranksep: 72 },
};
const GROUP_SPACING = { nodesep: 12, ranksep: 48 };

/** Size of a node that is not a group (groups are sized by their children). */
const leafSize = (node: FlowNode): Size =>
  NODE_SIZE[node.kind === undefined || node.kind === 'group' ? 'item' : node.kind];

interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface NodeLayout extends Size {
  /** Top-left corner; relative to the parent group when `parent` is set. */
  x: number;
  y: number;
  parent?: string;
}

export interface GraphLayout extends Size {
  nodes: Map<string, NodeLayout>;
  /**
   * Orthogonal route of each edge, keyed by edge id, from the source handle to the target handle
   * in absolute coordinates. Missing for edges the layout could not route forward (between nodes
   * of one column, against the column order, or inside a cycle); draw those directly.
   */
  edges: Map<string, EdgeRoute>;
}

export interface EdgeRoute {
  points: Point[];
  /** Center of the edge's label. */
  label: Point;
}

interface Box extends Size {
  id: string;
}

interface Rect extends Size {
  x: number;
  y: number;
}

type Link = readonly [string, string];
const linkKey = (source: string, target: string) => `${source}\u0000${target}`;

interface DagreResult {
  /** Top-left corners, normalized so the layout starts at (0, 0). */
  positions: Map<string, Point>;
  size: Size;
  /** Dagre's waypoints per link (by `linkKey`), in the same coordinates as `positions`. */
  points: Map<string, Point[]>;
}

/**
 * Runs dagre. With `ranks`, dagre's own ranking is replaced: every box gets its given rank, so a
 * node lands in its column and an edge that skips columns gets dummy nodes in each column it
 * crosses, which keeps the nodes in between off its path. Links must then point to a higher rank.
 */
function runDagre(
  boxes: readonly Box[],
  links: readonly Link[],
  direction: FlowDirection,
  spacing: { nodesep: number; ranksep: number },
  ranks?: ReadonlyMap<string, number>,
): DagreResult {
  // Dagre doubles every edge's length internally to make room for edge labels, so a column is two
  // of its ranks. Its nesting root (`_root`) must rank before everything else.
  const ranker = ranks
    ? (graph: Graph<GraphLabel, NodeLabel, EdgeLabel>) => {
        for (const id of graph.nodes()) graph.node(id).rank = 2 * (ranks.get(id) ?? -0.5);
      }
    : undefined;
  const build = () => {
    const graph = new dagre.graphlib.Graph<GraphLabel, NodeLabel, EdgeLabel>();
    graph.setGraph({
      rankdir: direction,
      ...spacing,
      marginx: 0,
      marginy: 0,
      // The typings only list the built-in rankers, dagre also calls a function.
      ...(ranker ? { ranker: ranker as unknown as GraphLabel['ranker'] } : {}),
    });
    graph.setDefaultEdgeLabel(() => ({}));
    for (const box of boxes) graph.setNode(box.id, { width: box.width, height: box.height });
    for (const [source, target] of links) graph.setEdge(source, target);
    return graph;
  };

  // Dagre reorders the nodes of a rank to save crossings, which sorted lists (services by name,
  // clusters by name) do not survive: it tends to reverse a plain fan. The first pass finds the
  // ranks, the second keeps every rank in input order, so the graph reads like the list next to
  // it and callers decide the order.
  let graph = build();
  dagre.layout(graph);
  const rankAxis = direction === 'LR' ? 'x' : 'y';
  const lastInRank = new Map<number, string>();
  const constraints: { left: string; right: string }[] = [];
  for (const box of boxes) {
    const rank = Math.round(graph.node(box.id)[rankAxis] ?? 0);
    const previous = lastInRank.get(rank);
    if (previous !== undefined) constraints.push({ left: previous, right: box.id });
    lastInRank.set(rank, box.id);
  }
  if (constraints.length) {
    graph = build();
    dagre.layout(graph, { constraints });
  }

  const positions = new Map<string, Point>();
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const box of boxes) {
    const { x = 0, y = 0 } = graph.node(box.id);
    const left = x - box.width / 2;
    const top = y - box.height / 2;
    positions.set(box.id, { x: left, y: top });
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + box.width);
    maxY = Math.max(maxY, top + box.height);
  }
  const points = new Map<string, Point[]>();
  if (!boxes.length) return { positions, size: { width: 0, height: 0 }, points };
  for (const position of positions.values()) {
    position.x -= minX;
    position.y -= minY;
  }
  for (const [source, target] of links) {
    const route = graph.edge(source, target).points ?? [];
    points.set(
      linkKey(source, target),
      route.map((point) => ({ x: point.x - minX, y: point.y - minY })),
    );
  }
  return { positions, size: { width: maxX - minX, height: maxY - minY }, points };
}

/**
 * Ranks for a layout with columns: a node with a `column` gets it, the others follow their edges
 * (one past their furthest predecessor, or one before their nearest successor).
 */
function columnRanks(
  boxes: readonly Box[],
  links: readonly Link[],
  columnOf: ReadonlyMap<string, number | undefined>,
): Map<string, number> {
  const ranks = new Map<string, number>();
  for (const box of boxes) {
    const column = columnOf.get(box.id);
    if (column !== undefined) ranks.set(box.id, column);
  }
  const free = boxes.filter((box) => !ranks.has(box.id)).map((box) => box.id);
  // Bounded, so a cycle among free nodes cannot push them out forever.
  for (let round = 0; round < free.length; round++) {
    let changed = false;
    for (const [source, target] of links) {
      const from = ranks.get(source);
      if (from === undefined || columnOf.get(target) !== undefined) continue;
      if ((ranks.get(target) ?? -Infinity) < from + 1) {
        ranks.set(target, from + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const id of free) {
    if (ranks.has(id)) continue;
    const successors = links
      .filter(([source, target]) => source === id && ranks.has(target))
      .map(([, target]) => ranks.get(target) ?? 0);
    ranks.set(id, successors.length ? Math.min(...successors) - 1 : 0);
  }
  const lowest = Math.min(0, ...ranks.values());
  for (const [id, rank] of ranks) ranks.set(id, rank - lowest);
  return ranks;
}

interface RouteRequest {
  id: string;
  /** The real endpoints, whose handles the route starts and ends at. */
  source: Rect;
  target: Rect;
  /** The top-level boxes (the groups of children) that dagre placed for this edge. */
  sourceBox: string;
  targetBox: string;
  /** Owner of the shared trunk: edges from one node branch off one vertical line. */
  trunk: string;
  points: readonly Point[];
}

/**
 * Turns dagre's waypoints into orthogonal routes. A route only runs across the graph inside the
 * gaps between columns, and along a column only on the lane dagre reserved for it there, so it
 * never crosses a node. Edges from one node share a trunk in each gap; different nodes get
 * different trunks, spread across the gap, so unrelated edges do not merge into one line.
 */
function routeEdges(
  boxes: ReadonlyMap<string, Rect>,
  requests: readonly RouteRequest[],
  direction: FlowDirection,
): Map<string, Point[]> {
  const lr = direction === 'LR';
  const rankStart = (rect: Rect) => (lr ? rect.x : rect.y);
  const rankSize = (rect: Rect) => (lr ? rect.width : rect.height);
  const crossCenter = (rect: Rect) => (lr ? rect.y + rect.height / 2 : rect.x + rect.width / 2);
  const rankOf = (point: Point) => (lr ? point.x : point.y);
  const crossOf = (point: Point) => (lr ? point.y : point.x);
  const at = (rank: number, cross: number): Point =>
    lr ? { x: rank, y: cross } : { x: cross, y: rank };

  // Columns as dagre placed them: boxes sharing a center along the rank axis.
  const columns = new Map<number, { start: number; end: number }>();
  const columnKey = new Map<string, number>();
  for (const [id, rect] of boxes) {
    const key = Math.round(rankStart(rect) + rankSize(rect) / 2);
    columnKey.set(id, key);
    const extent = columns.get(key);
    const start = rankStart(rect);
    const end = start + rankSize(rect);
    columns.set(key, {
      start: Math.min(extent?.start ?? start, start),
      end: Math.max(extent?.end ?? end, end),
    });
  }
  const sorted = [...columns.entries()].sort(([a], [b]) => a - b).map(([, extent]) => extent);
  const indexOf = new Map(
    [...columns.keys()].sort((a, b) => a - b).map((key, index) => [key, index]),
  );
  const columnIndex = (id: string) => indexOf.get(columnKey.get(id) ?? NaN);

  interface Plan {
    request: RouteRequest;
    first: number;
    /** Cross position on entering each gap, then the target's. */
    crosses: number[];
  }
  const plans: Plan[] = [];
  for (const request of requests) {
    const first = columnIndex(request.sourceBox);
    const last = columnIndex(request.targetBox);
    if (first === undefined || last === undefined || last <= first) continue;
    const crosses = [crossCenter(request.source)];
    for (let column = first + 1; column < last; column++) {
      const extent = sorted[column];
      const lane = request.points.find(
        (point) => extent && rankOf(point) >= extent.start && rankOf(point) <= extent.end,
      );
      crosses.push(lane ? crossOf(lane) : (crosses.at(-1) ?? 0));
    }
    crosses.push(crossCenter(request.target));
    plans.push({ request, first, crosses });
  }

  // Trunk positions per gap: one per owner, ordered by where the owners' edges arrive.
  const arrivals = new Map<number, Map<string, number[]>>();
  for (const { request, first, crosses } of plans) {
    for (let step = 0; step < crosses.length - 1; step++) {
      const owners = arrivals.get(first + step) ?? new Map<string, number[]>();
      arrivals.set(first + step, owners);
      owners.set(request.trunk, [...(owners.get(request.trunk) ?? []), crosses[step] ?? 0]);
    }
  }
  const trunks = new Map<string, number>();
  for (const [gap, owners] of arrivals) {
    const start = sorted[gap]?.end ?? 0;
    const end = sorted[gap + 1]?.start ?? start;
    const mean = (values: readonly number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    const order = [...owners.entries()]
      .map(([owner, values]) => [owner, mean(values)] as const)
      .sort(([a, x], [b, y]) => x - y || a.localeCompare(b));
    // Spread over the gap but one slot short of the target side, which keeps the last stretch
    // into each target long enough for its label.
    order.forEach(([owner], index) => {
      trunks.set(
        `${gap}\u0000${owner}`,
        start + ((end - start) * (index + 1)) / (order.length + 2),
      );
    });
  }

  const routes = new Map<string, Point[]>();
  for (const { request, first, crosses } of plans) {
    const { source, target } = request;
    const route = [at(rankStart(source) + rankSize(source), crossCenter(source))];
    for (let step = 0; step < crosses.length - 1; step++) {
      const trunk = trunks.get(`${first + step}\u0000${request.trunk}`) ?? 0;
      route.push(at(trunk, crosses[step] ?? 0), at(trunk, crosses[step + 1] ?? 0));
    }
    route.push(at(rankStart(target), crossCenter(target)));
    routes.set(request.id, simplify(route));
  }
  return routes;
}

/** Drops repeated points and the middle one of three in a line. */
function simplify(points: readonly Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const last = result.at(-1);
    if (last && last.x === point.x && last.y === point.y) continue;
    const before = result.at(-2);
    if (
      before &&
      last &&
      ((before.x === last.x && last.x === point.x) || (before.y === last.y && last.y === point.y))
    ) {
      result[result.length - 1] = point;
      continue;
    }
    result.push(point);
  }
  return result;
}

/**
 * Places the nodes with dagre and routes the edges. Groups are laid out inside out: first each
 * group's children (with the edges between them), which gives the group its size, then the
 * groups and the other top-level nodes, with every edge that touches a child counted as an edge of
 * its group.
 *
 * Pure and deterministic: the same nodes and edges in the same order give the same positions.
 * Nodes that share a column keep their input order across it. Edges to unknown ids are ignored;
 * edges within a column or against the columns are left out of the layout and not routed.
 */
export function layoutGraph(
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
  direction: FlowDirection = 'LR',
): GraphLayout {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const isGroup = (id: string | undefined) => id !== undefined && byId.get(id)?.kind === 'group';
  const parentOf = (node: FlowNode) =>
    node.kind !== 'group' && isGroup(node.group) ? node.group : undefined;

  const children = new Map<string, FlowNode[]>();
  for (const node of nodes) {
    const parent = parentOf(node);
    if (parent) children.set(parent, [...(children.get(parent) ?? []), node]);
  }
  const knownEdges = edges.filter((edge) => byId.has(edge.source) && byId.has(edge.target));

  const result = new Map<string, NodeLayout>();
  const groupSizes = new Map<string, Size>();
  const inner = new Map<string, { result: DagreResult; inset: number }>();
  for (const node of nodes) {
    if (node.kind !== 'group') continue;
    const members = children.get(node.id) ?? [];
    if (!members.length) {
      groupSizes.set(node.id, EMPTY_GROUP);
      continue;
    }
    const memberIds = new Set(members.map((member) => member.id));
    const innerLinks = knownEdges
      .filter((edge) => memberIds.has(edge.source) && memberIds.has(edge.target))
      .map((edge) => [edge.source, edge.target] as const);
    // Members without edges between them are a list and stack top to bottom. Laid out in the
    // graph's direction, a top-to-bottom graph would put them in one row, and a row of groups full
    // of rows grows too wide to read (the clusters and workers of the infrastructure view).
    const layout = runDagre(
      members.map((member) => ({ id: member.id, ...leafSize(member) })),
      innerLinks,
      innerLinks.length ? direction : 'LR',
      GROUP_SPACING,
    );
    const width = Math.max(layout.size.width + 2 * GROUP_PADDING, EMPTY_GROUP.width);
    const height = GROUP_HEADER + layout.size.height + GROUP_PADDING;
    groupSizes.set(node.id, { width, height });
    // A group wider than its content (a long title) centers the content.
    const inset = (width - layout.size.width) / 2;
    inner.set(node.id, { result: layout, inset });
    for (const member of members) {
      const { x, y } = layout.positions.get(member.id) ?? { x: 0, y: 0 };
      result.set(member.id, {
        x: x + inset,
        y: y + GROUP_HEADER,
        ...leafSize(member),
        parent: node.id,
      });
    }
  }

  const topLevel: Box[] = nodes
    .filter((node) => !parentOf(node))
    .map((node) => ({
      id: node.id,
      ...(node.kind === 'group' ? (groupSizes.get(node.id) ?? EMPTY_GROUP) : leafSize(node)),
    }));
  const lift = (id: string) => {
    const node = byId.get(id);
    return (node && parentOf(node)) ?? id;
  };
  const links = new Map<string, Link>();
  for (const edge of knownEdges) {
    const source = lift(edge.source);
    const target = lift(edge.target);
    if (source !== target) links.set(linkKey(source, target), [source, target]);
  }

  const columnOf = new Map(topLevel.map((box) => [box.id, byId.get(box.id)?.column]));
  const hasColumns = [...columnOf.values()].some((column) => column !== undefined);
  const ranks = hasColumns ? columnRanks(topLevel, [...links.values()], columnOf) : undefined;
  // With fixed ranks, a link within a column or against the columns cannot be laid out forward.
  const laidOut = [...links.values()].filter(
    ([source, target]) => !ranks || (ranks.get(target) ?? 0) > (ranks.get(source) ?? 0),
  );
  const outer = runDagre(topLevel, laidOut, direction, SPACING[direction], ranks);
  // Dagre centers every node on its rank, so groups of different sizes in one row hang at
  // different heights (or start at different x left to right). Aligning their leading edges reads
  // as a tidy row. Only the rank axis moves, toward the rank's leading edge, and never past it, so
  // the gap to the previous rank stays at least what dagre left for its largest node.
  const rankAxis = direction === 'TB' ? 'y' : 'x';
  const rankExtent = (box: Box) => (direction === 'TB' ? box.height : box.width);
  const leadingByRank = new Map<number, number>();
  const rankOf = (box: Box) => {
    const position = outer.positions.get(box.id) ?? { x: 0, y: 0 };
    return Math.round(position[rankAxis] + rankExtent(box) / 2);
  };
  for (const box of topLevel) {
    const lead = outer.positions.get(box.id)?.[rankAxis] ?? 0;
    const rank = rankOf(box);
    leadingByRank.set(rank, Math.min(leadingByRank.get(rank) ?? lead, lead));
  }
  for (const box of topLevel) {
    const position = { ...(outer.positions.get(box.id) ?? { x: 0, y: 0 }) };
    position[rankAxis] = leadingByRank.get(rankOf(box)) ?? position[rankAxis];
    result.set(box.id, { ...position, width: box.width, height: box.height });
  }

  const absolute = (id: string): Rect => {
    const box = result.get(id) ?? { x: 0, y: 0, width: 0, height: 0 };
    const parent = box.parent ? result.get(box.parent) : undefined;
    return {
      x: box.x + (parent?.x ?? 0),
      y: box.y + (parent?.y ?? 0),
      width: box.width,
      height: box.height,
    };
  };

  const outerRequests: RouteRequest[] = [];
  const innerRequests = new Map<string, RouteRequest[]>();
  for (const edge of knownEdges) {
    const sourceBox = lift(edge.source);
    const targetBox = lift(edge.target);
    const request = {
      id: edge.id,
      source: absolute(edge.source),
      target: absolute(edge.target),
      trunk: edge.source,
    };
    if (sourceBox !== targetBox) {
      const points = outer.points.get(linkKey(sourceBox, targetBox));
      if (points) outerRequests.push({ ...request, sourceBox, targetBox, points });
      continue;
    }
    const group = inner.get(sourceBox);
    if (!group || edge.source === sourceBox || edge.target === sourceBox) continue;
    const origin = absolute(sourceBox);
    const points = (group.result.points.get(linkKey(edge.source, edge.target)) ?? []).map(
      (point) => ({ x: point.x + origin.x + group.inset, y: point.y + origin.y + GROUP_HEADER }),
    );
    const list = innerRequests.get(sourceBox) ?? [];
    list.push({ ...request, sourceBox: edge.source, targetBox: edge.target, points });
    innerRequests.set(sourceBox, list);
  }

  const routes = routeEdges(
    new Map(topLevel.map((box) => [box.id, absolute(box.id)])),
    outerRequests,
    direction,
  );
  for (const [group, requests] of innerRequests) {
    const members = children.get(group) ?? [];
    const memberBoxes = new Map(members.map((member) => [member.id, absolute(member.id)]));
    for (const [id, route] of routeEdges(memberBoxes, requests, direction)) routes.set(id, route);
  }

  const incoming = new Map<string, number>();
  for (const edge of knownEdges) {
    if (routes.has(edge.id)) incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }
  const edgeRoutes = new Map<string, EdgeRoute>();
  for (const edge of knownEdges) {
    const points = routes.get(edge.id);
    if (!points) continue;
    edgeRoutes.set(edge.id, {
      points,
      label: labelPoint(points, (incoming.get(edge.target) ?? 0) > 1),
    });
  }
  return { nodes: result, edges: edgeRoutes, ...outer.size };
}

/** SVG path along an orthogonal route, with corners rounded to at most `radius`. */
export function roundedPath(points: readonly Point[], radius = 8): string {
  const [start, ...rest] = points;
  if (!start) return '';
  let path = `M ${start.x} ${start.y}`;
  for (let index = 0; index < rest.length; index++) {
    const corner = rest[index];
    const before = points[index];
    const after = rest[index + 1];
    if (!corner || !before) continue;
    if (!after) {
      path += ` L ${corner.x} ${corner.y}`;
      continue;
    }
    const inLength = Math.hypot(corner.x - before.x, corner.y - before.y);
    const outLength = Math.hypot(after.x - corner.x, after.y - corner.y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    const enter = {
      x: corner.x - ((corner.x - before.x) / (inLength || 1)) * r,
      y: corner.y - ((corner.y - before.y) / (inLength || 1)) * r,
    };
    const leave = {
      x: corner.x + ((after.x - corner.x) / (outLength || 1)) * r,
      y: corner.y + ((after.y - corner.y) / (outLength || 1)) * r,
    };
    path += ` L ${enter.x} ${enter.y} Q ${corner.x} ${corner.y} ${leave.x} ${leave.y}`;
  }
  return path;
}

// How far a label sits from the end of its stretch: inside the last gap, clear of the trunk.
const LABEL_OFFSET = 40;

const along = (from: Point, to: Point, distance: number): Point => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const share = length ? Math.min(distance, length / 2) / length : 0;
  return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
};

/**
 * Where an edge label goes, on a stretch only this edge uses, so labels do not pile up. Edges of a
 * fan share their first stretch (the trunk) but not their last one, so the label sits on the last
 * stretch near the target. Edges that `merge` into one target share that last stretch, so their
 * labels move back to the stretch on their own lane, near where it turns towards the target.
 */
export function labelPoint(points: readonly Point[], merge = false): Point {
  const end = points.at(-1) ?? { x: 0, y: 0 };
  const before = points.at(-2) ?? end;
  if (!merge) return along(end, before, LABEL_OFFSET);
  const lane = points.at(-4);
  const turn = points.at(-3);
  // Without a turn the edge runs on the target's line all the way: label near its own start.
  return lane && turn ? along(turn, lane, LABEL_OFFSET) : along(before, end, LABEL_OFFSET);
}

/**
 * What the layout depends on. Tones, labels and descriptions are left out on purpose, so a status
 * update recolors the graph without moving anything. Sorted, so a list that comes back in another
 * order does not reshuffle the graph either; the layout then keeps the order it was first given.
 */
export function layoutKey(
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
  direction: FlowDirection,
): string {
  return JSON.stringify([
    direction,
    nodes
      .map((node) =>
        [node.id, node.kind ?? 'item', node.group ?? '', node.column ?? ''].join('\u0000'),
      )
      .sort(),
    edges.map((edge) => [edge.id, edge.source, edge.target].join('\u0000')).sort(),
  ]);
}
