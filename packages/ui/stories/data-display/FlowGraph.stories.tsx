import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { FlowGraph, type FlowEdge, type FlowNode } from '../../src/flow';

const meta = {
  title: 'Data display/FlowGraph',
  component: FlowGraph,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A node and edge graph from the `@oakestra/ui/flow` subpath, laid out automatically (dagre) and drawn with React Flow, which loads lazily. Describe nodes and edges; positions are computed and only change when the set of ids changes, so status updates recolor the graph in place. Nodes in a column keep their input order. The frame takes its height from the graph: the zoom that fits the frame width (never below a readable 0.6, the rest is a pan away), bounded by `minHeight` and `maxHeight`; it refits when the frame changes width. A wheel over the graph scrolls the page; zoom with the controls or pinch, pan by dragging. Under `prefers-reduced-motion` edge animation, pulsing glyphs and animated fits are off. Pair every graph with a list that says the same thing.',
      },
    },
  },
  args: {
    ariaLabel: 'Example graph',
    direction: 'LR',
    nodes: [
      { id: 'app', label: 'web-shop', kind: 'primary', description: '3 services' },
      { id: 'frontend', label: 'frontend', tone: 'success', description: '2/2 running' },
      { id: 'api', label: 'api', tone: 'info', pulse: true, description: 'Scheduling' },
      { id: 'db', label: 'database', tone: 'destructive', description: 'Failed' },
    ],
    edges: [
      { id: 'app-frontend', source: 'app', target: 'frontend' },
      { id: 'app-api', source: 'app', target: 'api' },
      { id: 'app-db', source: 'app', target: 'db' },
    ],
  },
  argTypes: {
    nodes: { control: 'object' },
    edges: { control: 'object' },
    renderLink: { control: false },
    onNodeClick: { control: false },
  },
} satisfies Meta<typeof FlowGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const topologyNodes: FlowNode[] = [
  { id: 'app', label: 'web-shop', kind: 'primary', column: 0, href: '#app' },
  {
    id: 'frontend',
    label: 'frontend',
    tone: 'success',
    description: '2/2 running',
    column: 1,
    href: '#frontend',
  },
  { id: 'api', label: 'api', tone: 'warning', description: '1/2 running', column: 1 },
  { id: 'cache', label: 'cache', tone: 'info', pulse: true, description: 'Scheduling', column: 1 },
  { id: 'munich', label: 'edge-munich', kind: 'group', tone: 'success', column: 2 },
  { id: 'munich-1', label: 'worker-1', kind: 'compact', tone: 'success', group: 'munich' },
  { id: 'munich-2', label: 'worker-2', kind: 'compact', tone: 'warning', group: 'munich' },
  { id: 'berlin', label: 'edge-berlin', kind: 'group', stale: true, column: 2 },
  { id: 'berlin-1', label: 'worker-1', kind: 'compact', stale: true, group: 'berlin' },
];
const topologyEdges: FlowEdge[] = [
  { id: 'app-frontend', source: 'app', target: 'frontend' },
  { id: 'app-api', source: 'app', target: 'api' },
  { id: 'app-cache', source: 'app', target: 'cache' },
  {
    id: 'frontend-api',
    source: 'frontend',
    target: 'api',
    variant: 'dashed',
    label: 'port 8080',
  },
  { id: 'frontend-m1', source: 'frontend', target: 'munich-1', tone: 'success', animated: true },
  { id: 'frontend-m2', source: 'frontend', target: 'munich-2', tone: 'success', animated: true },
  { id: 'api-m2', source: 'api', target: 'munich-2', tone: 'warning', label: '×2' },
  { id: 'api-b1', source: 'api', target: 'berlin-1', label: '×1' },
];

/** Selection lives in the caller: click a node or press Enter on it. */
export const Topology: Story = {
  args: { ariaLabel: 'Application topology', nodes: topologyNodes, edges: topologyEdges },
  render: function Render(args) {
    const [selected, setSelected] = useState<string | null>(null);
    return (
      <div className="flex flex-col gap-2">
        <FlowGraph {...args} selectedId={selected} onNodeClick={(node) => setSelected(node.id)} />
        <p className="text-sm text-muted-foreground">Selected: {selected ?? 'nothing'}</p>
      </div>
    );
  },
};

/**
 * The interaction a detail panel builds on: rest the pointer on a node (or tab to it) for a card,
 * click or press Enter to select, click the background or press Escape to clear. The selection
 * keeps its connections highlighted. Nodes here have no `href`, since a label link would compete
 * with the select click.
 */
export const HoverAndSelection: Story = {
  args: {
    ariaLabel: 'Application topology',
    nodes: topologyNodes.map(({ href: _href, ...node }) => node),
    edges: topologyEdges,
  },
  render: function Render(args) {
    const [selected, setSelected] = useState<string | null>('api');
    return (
      <div className="flex flex-col gap-2">
        <FlowGraph
          {...args}
          selectedId={selected}
          onNodeClick={(node) => setSelected(node.id)}
          onBackgroundClick={() => setSelected(null)}
          renderHoverCard={(node) =>
            node.kind === 'primary' ? null : (
              <div className="flex flex-col gap-1">
                <span className="font-medium">{node.label}</span>
                <span className="text-xs text-muted-foreground">
                  {node.description ?? (node.stale ? 'Not reporting' : 'No details')}
                </span>
              </div>
            )
          }
        />
        <p className="text-sm text-muted-foreground">Selected: {selected ?? 'nothing'}</p>
      </div>
    );
  },
};

const clusters = ['edge-munich', 'edge-berlin', 'edge-zurich', 'edge-vienna'];
const blockers: Record<string, string | undefined> = {
  'edge-berlin': 'memory',
  'edge-zurich': 'runtime',
};

/**
 * A compact fan: one service, an edge per cluster, labelled with what blocks it. The frame is only
 * as tall as the fan.
 */
export const Placement: Story = {
  args: {
    ariaLabel: 'Placement of api',
    nodes: [
      { id: 'service', label: 'api', kind: 'primary', tone: 'destructive' },
      ...clusters.map((name): FlowNode => ({
        id: name,
        label: name,
        tone: name === 'edge-vienna' ? 'neutral' : blockers[name] ? 'destructive' : 'success',
        stale: name === 'edge-vienna',
        description:
          name === 'edge-vienna' ? 'Not reporting' : blockers[name] ? 'Blocked' : 'Passes',
      })),
    ],
    edges: clusters.map((name): FlowEdge => ({
      id: `service-${name}`,
      source: 'service',
      target: name,
      ...(name === 'edge-vienna'
        ? { variant: 'dashed' }
        : blockers[name]
          ? { tone: 'destructive', label: blockers[name] }
          : { tone: 'success' }),
    })),
  },
};

/** Top to bottom, as for a fleet of clusters and their workers. */
export const TopToBottom: Story = {
  args: { ...Topology.args, direction: 'TB', ariaLabel: 'Fleet' },
};

/**
 * With `prefers-reduced-motion: reduce` set in the OS (or emulated in the browser's dev tools),
 * the animated edges of this story are still and the pulsing glyph is steady.
 */
export const ReducedMotion: Story = {
  args: {
    ariaLabel: 'Animated edges',
    nodes: [
      { id: 'a', label: 'producer', tone: 'info', pulse: true },
      { id: 'b', label: 'consumer', tone: 'success' },
    ],
    edges: [{ id: 'a-b', source: 'a', target: 'b', animated: true, tone: 'success' }],
  },
};
