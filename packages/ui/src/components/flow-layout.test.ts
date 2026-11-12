import { describe, expect, it } from 'vitest';

import type { FlowEdge, FlowNode } from './flow-graph-types';
import {
  GROUP_HEADER,
  labelPoint,
  layoutGraph,
  layoutKey,
  NODE_SIZE,
  roundedPath,
  type NodeLayout,
  type Point,
} from './flow-layout';

const fan: FlowNode[] = [
  { id: 'app', label: 'App', kind: 'primary' },
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
];
const fanEdges: FlowEdge[] = [
  { id: 'app-a', source: 'app', target: 'a' },
  { id: 'app-b', source: 'app', target: 'b' },
  { id: 'app-c', source: 'app', target: 'c' },
];

const at = (layout: ReturnType<typeof layoutGraph>, id: string) => {
  const box = layout.nodes.get(id);
  if (!box) throw new Error(`no layout for ${id}`);
  return box;
};

describe('layoutGraph', () => {
  it('is deterministic', () => {
    const first = layoutGraph(fan, fanEdges, 'LR');
    const second = layoutGraph(structuredClone(fan), structuredClone(fanEdges), 'LR');
    expect([...second.nodes]).toEqual([...first.nodes]);
    expect(second.width).toBe(first.width);
    expect(second.height).toBe(first.height);
  });

  it('places targets after their source along the direction, in input order across it', () => {
    const lr = layoutGraph(fan, fanEdges, 'LR');
    for (const id of ['a', 'b', 'c']) expect(at(lr, id).x).toBeGreaterThan(at(lr, 'app').x);
    expect(at(lr, 'a').y).toBeLessThan(at(lr, 'b').y);
    expect(at(lr, 'b').y).toBeLessThan(at(lr, 'c').y);

    const tb = layoutGraph(fan, fanEdges, 'TB');
    for (const id of ['a', 'b', 'c']) expect(at(tb, id).y).toBeGreaterThan(at(tb, 'app').y);
    expect(at(tb, 'a').x).toBeLessThan(at(tb, 'b').x);
  });

  it('starts at the origin and uses the fixed size of each kind', () => {
    const layout = layoutGraph(fan, fanEdges, 'LR');
    const boxes = [...layout.nodes.values()];
    expect(Math.min(...boxes.map((box) => box.x))).toBe(0);
    expect(Math.min(...boxes.map((box) => box.y))).toBe(0);
    expect(at(layout, 'app')).toMatchObject(NODE_SIZE.primary);
    expect(at(layout, 'a')).toMatchObject(NODE_SIZE.item);
  });

  it('honors columns, also for nodes without edges', () => {
    const nodes: FlowNode[] = [
      { id: 'app', label: 'App', kind: 'primary', column: 0 },
      { id: 'svc', label: 'Service', column: 1 },
      { id: 'cluster-1', label: 'Cluster 1', column: 2 },
      // Unused cluster: dagre alone would put it in the first column.
      { id: 'cluster-2', label: 'Cluster 2', column: 2 },
    ];
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'app', target: 'svc' },
      { id: 'e2', source: 'svc', target: 'cluster-1' },
    ];
    const layout = layoutGraph(nodes, edges, 'LR');
    expect(at(layout, 'svc').x).toBeGreaterThan(at(layout, 'app').x);
    expect(at(layout, 'cluster-1').x).toBeGreaterThan(at(layout, 'svc').x);
    expect(at(layout, 'cluster-2').x).toBe(at(layout, 'cluster-1').x);
    // Stacked, not overlapping.
    const [upper, lower] = [at(layout, 'cluster-1'), at(layout, 'cluster-2')].sort(
      (a, b) => a.y - b.y,
    );
    expect(lower!.y).toBeGreaterThanOrEqual(upper!.y + upper!.height);
    expect(layout.width).toBe(at(layout, 'cluster-1').x + NODE_SIZE.item.width);
  });

  it('lays out children inside their group and the group among the other nodes', () => {
    const nodes: FlowNode[] = [
      { id: 'svc', label: 'Service' },
      { id: 'cluster', label: 'Cluster', kind: 'group' },
      { id: 'w1', label: 'worker-1', kind: 'compact', group: 'cluster' },
      { id: 'w2', label: 'worker-2', kind: 'compact', group: 'cluster' },
      // Not a group: drawn at the top level.
      { id: 'orphan', label: 'Orphan', group: 'svc' },
    ];
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'svc', target: 'w1' },
      { id: 'e2', source: 'svc', target: 'missing' },
    ];
    const layout = layoutGraph(nodes, edges, 'LR');
    const group = at(layout, 'cluster');

    for (const id of ['w1', 'w2']) {
      const child = at(layout, id);
      expect(child.parent).toBe('cluster');
      expect(child.x).toBeGreaterThanOrEqual(0);
      expect(child.y).toBeGreaterThanOrEqual(GROUP_HEADER);
      expect(child.x + child.width).toBeLessThanOrEqual(group.width);
      expect(child.y + child.height).toBeLessThanOrEqual(group.height);
    }
    // The edge to a child counts for its group, which therefore follows the service.
    expect(group.x).toBeGreaterThan(at(layout, 'svc').x);
    expect(at(layout, 'orphan').parent).toBeUndefined();
  });
});

/** Absolute box of a node, adding its group's position for a child. */
const absolute = (layout: ReturnType<typeof layoutGraph>, id: string) => {
  const box = at(layout, id);
  const parent = box.parent ? at(layout, box.parent) : { x: 0, y: 0 };
  return { ...box, x: box.x + parent.x, y: box.y + parent.y };
};

/** Whether an axis-parallel segment passes through the inside of a box. */
const crosses = (
  [a, b]: [Point, Point],
  box: { x: number; y: number; width: number; height: number },
) =>
  Math.max(a.x, b.x) > box.x &&
  Math.min(a.x, b.x) < box.x + box.width &&
  Math.max(a.y, b.y) > box.y &&
  Math.min(a.y, b.y) < box.y + box.height;

const segments = (route: readonly Point[]) =>
  route.slice(1).map((point, index): [Point, Point] => [route[index]!, point]);

describe('edge routes', () => {
  // One chain over four columns and an edge from the first straight to the last. A naive step
  // line would run through the two nodes in between.
  const chain: FlowNode[] = [
    { id: 'app', label: 'App', kind: 'primary', column: 0 },
    { id: 'frontend', label: 'frontend', column: 1 },
    { id: 'api', label: 'api', column: 2 },
    { id: 'cache', label: 'cache', column: 3 },
    { id: 'cluster', label: 'cluster', column: 4 },
  ];
  const chainEdges: FlowEdge[] = [
    { id: 'app-frontend', source: 'app', target: 'frontend' },
    { id: 'frontend-api', source: 'frontend', target: 'api', variant: 'dashed' },
    { id: 'api-cache', source: 'api', target: 'cache', variant: 'dashed' },
    { id: 'frontend-cluster', source: 'frontend', target: 'cluster', label: '×2' },
    { id: 'cache-cluster', source: 'cache', target: 'cluster' },
  ];

  it.each(['LR', 'TB'] as const)(
    'routes an edge that skips columns around them (%s)',
    (direction) => {
      const layout = layoutGraph(chain, chainEdges, direction);
      const rank = (id: string) => (direction === 'LR' ? at(layout, id).x : at(layout, id).y);
      expect(rank('app')).toBeLessThan(rank('frontend'));
      expect(rank('frontend')).toBeLessThan(rank('api'));
      expect(rank('api')).toBeLessThan(rank('cache'));
      expect(rank('cache')).toBeLessThan(rank('cluster'));

      const route = layout.edges.get('frontend-cluster')?.points;
      expect(route).toBeDefined();
      for (const segment of segments(route!)) {
        expect(segment[0].x === segment[1].x || segment[0].y === segment[1].y).toBe(true);
        for (const id of ['api', 'cache']) expect(crosses(segment, at(layout, id))).toBe(false);
      }
      // From the source's handle to the target's.
      const source = at(layout, 'frontend');
      const target = at(layout, 'cluster');
      expect(route![0]).toEqual(
        direction === 'LR'
          ? { x: source.x + source.width, y: source.y + source.height / 2 }
          : { x: source.x + source.width / 2, y: source.y + source.height },
      );
      expect(route!.at(-1)).toEqual(
        direction === 'LR'
          ? { x: target.x, y: target.y + target.height / 2 }
          : { x: target.x + target.width / 2, y: target.y },
      );
    },
  );

  it('does not route edges within a column or against the columns', () => {
    const layout = layoutGraph(
      chain,
      [
        ...chainEdges,
        { id: 'same', source: 'api', target: 'api' },
        { id: 'back', source: 'cache', target: 'frontend' },
      ],
      'LR',
    );
    expect(layout.edges.has('back')).toBe(false);
    expect(layout.edges.has('same')).toBe(false);
    // And they do not pull anything out of its column.
    expect(at(layout, 'frontend').x).toBeLessThan(at(layout, 'api').x);
  });

  it('gives each edge of a fan its own label spot', () => {
    const layout = layoutGraph(fan, fanEdges, 'LR');
    const spots = fanEdges.map((edge) => layout.edges.get(edge.id)?.label ?? { x: 0, y: 0 });
    expect(new Set(spots.map((spot) => `${spot.x}:${spot.y}`)).size).toBe(fanEdges.length);
  });

  it('routes into children of groups, between and within them', () => {
    const nodes: FlowNode[] = [
      { id: 'svc', label: 'Service', column: 0 },
      { id: 'cluster', label: 'Cluster', kind: 'group', column: 1 },
      { id: 'w1', label: 'worker-1', kind: 'compact', group: 'cluster' },
      { id: 'w2', label: 'worker-2', kind: 'compact', group: 'cluster' },
      { id: 'w3', label: 'worker-3', kind: 'compact', group: 'cluster' },
    ];
    const edges: FlowEdge[] = [
      { id: 'svc-w2', source: 'svc', target: 'w2' },
      { id: 'w1-w3', source: 'w1', target: 'w3' },
    ];
    const layout = layoutGraph(nodes, edges, 'LR');

    const w2 = absolute(layout, 'w2');
    expect(layout.edges.get('svc-w2')?.points.at(-1)).toEqual({ x: w2.x, y: w2.y + w2.height / 2 });

    const inside = layout.edges.get('w1-w3')?.points;
    const w1 = absolute(layout, 'w1');
    const w3 = absolute(layout, 'w3');
    expect(inside?.[0]).toEqual({ x: w1.x + w1.width, y: w1.y + w1.height / 2 });
    expect(inside?.at(-1)).toEqual({ x: w3.x, y: w3.y + w3.height / 2 });
  });
});

describe('labelPoint', () => {
  const route: Point[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 200, y: 50 },
  ];

  it('puts a label near the target, or on its own lane when edges merge', () => {
    expect(labelPoint(route)).toEqual({ x: 160, y: 50 });
    expect(labelPoint(route, true)).toEqual({ x: 60, y: 0 });
    // Short stretches get the label in their middle.
    expect(labelPoint([route[2]!, { x: 120, y: 50 }])).toEqual({ x: 110, y: 50 });
  });
});

describe('roundedPath', () => {
  it('rounds corners without overshooting short segments', () => {
    expect(
      roundedPath([
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 6 },
        { x: 40, y: 6 },
      ]),
    ).toBe('M 0 0 L 17 0 Q 20 0 20 3 L 20 3 Q 20 6 23 6 L 40 6');
    expect(roundedPath([])).toBe('');
  });
});

describe('layoutKey', () => {
  it('ignores tones, labels and order but not structure', () => {
    const key = layoutKey(fan, fanEdges, 'LR');
    const recolored = fan.map((node) => ({ ...node, tone: 'destructive' as const, label: '?' }));
    expect(layoutKey(recolored, fanEdges, 'LR')).toBe(key);
    expect(layoutKey([...fan].reverse(), [...fanEdges].reverse(), 'LR')).toBe(key);

    expect(layoutKey(fan, fanEdges, 'TB')).not.toBe(key);
    expect(layoutKey(fan.slice(1), fanEdges, 'LR')).not.toBe(key);
    expect(layoutKey(fan, fanEdges.slice(1), 'LR')).not.toBe(key);
  });
});

describe('group members', () => {
  const nodes: FlowNode[] = [
    { id: 'root', label: 'Root' },
    { id: 'cluster', label: 'Cluster', kind: 'group' },
    { id: 'w1', label: 'w1', group: 'cluster' },
    { id: 'w2', label: 'w2', group: 'cluster' },
    { id: 'w3', label: 'w3', group: 'cluster' },
  ];
  const edges: FlowEdge[] = [{ id: 'root-cluster', source: 'root', target: 'cluster' }];

  it('stacks members without edges between them top to bottom, in either direction', () => {
    for (const direction of ['TB', 'LR'] as const) {
      const layout = layoutGraph(nodes, edges, direction);
      const [a, b, c] = ['w1', 'w2', 'w3'].map((id) => layout.nodes.get(id)!) as [
        NodeLayout,
        NodeLayout,
        NodeLayout,
      ];
      expect(a.x).toBe(b.x);
      expect(b.x).toBe(c.x);
      expect(a.y).toBeLessThan(b.y);
      expect(b.y).toBeLessThan(c.y);
    }
  });

  it('aligns groups of different heights in one row at their top', () => {
    const layout = layoutGraph(
      [
        ...nodes,
        { id: 'small', label: 'Small', kind: 'group' },
        { id: 's1', label: 's1', group: 'small' },
      ],
      [...edges, { id: 'root-small', source: 'root', target: 'small' }],
      'TB',
    );
    expect(layout.nodes.get('small')?.y).toBe(layout.nodes.get('cluster')?.y);
  });

  it('gives an empty group the width of a group with one item', () => {
    const layout = layoutGraph(
      [...nodes, { id: 'empty', label: 'edge-hamburg', kind: 'group' }],
      edges,
      'TB',
    );
    expect(layout.nodes.get('empty')?.width).toBe(layout.nodes.get('cluster')?.width);
  });
});
