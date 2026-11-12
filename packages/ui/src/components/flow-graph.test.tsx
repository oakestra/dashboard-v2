import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Position } from '@xyflow/react';

import { FlowGraph, type FlowEdge, type FlowNode } from '../flow';
import { arrowHead } from './flow-graph-impl';

// React Flow measures its pane with ResizeObserver and reads transforms through DOMMatrixReadOnly,
// neither of which jsdom has. Nodes still render: they carry fixed sizes from the layout.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.DOMMatrixReadOnly ??= class {
    m22 = 1;
    constructor(transform?: string) {
      const scale = /scale\(([\d.]+)\)/.exec(transform ?? '')?.[1];
      this.m22 = scale ? Number(scale) : 1;
    }
  } as unknown as typeof DOMMatrixReadOnly;
});

const nodes: FlowNode[] = [
  { id: 'app', label: 'shop', kind: 'primary', href: '/apps/shop' },
  { id: 'svc', label: 'frontend', tone: 'success', description: '2/2 running' },
  { id: 'cluster', label: 'edge-munich', kind: 'group', tone: 'warning' },
  { id: 'worker', label: 'worker-1', kind: 'compact', group: 'cluster', stale: true },
];
const edges: FlowEdge[] = [
  { id: 'app-svc', source: 'app', target: 'svc' },
  { id: 'svc-worker', source: 'svc', target: 'worker', label: '×2', animated: true },
];

const nodeElement = (id: string) => {
  const element = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
  if (!element) throw new Error(`node ${id} not rendered`);
  return element;
};

describe('FlowGraph', () => {
  it('renders every node inside a labelled group', async () => {
    render(<FlowGraph ariaLabel="Topology" nodes={nodes} edges={edges} />);

    const graph = await screen.findByRole('group', { name: 'Topology' });
    for (const label of ['shop', 'frontend', '2/2 running', 'edge-munich', 'worker-1']) {
      expect(graph).toHaveTextContent(label);
    }
    expect(nodeElement('worker').querySelector('[data-slot="status-dot"]')).toHaveAttribute(
      'data-stale',
      'true',
    );
    expect(nodeElement('cluster').querySelector('[data-slot="flow-node"]')).toHaveClass(
      'border-warning/60',
    );
  });

  it('calls onNodeClick on click and on Enter, but not for a click on the link', async () => {
    const onNodeClick = vi.fn();
    render(
      <FlowGraph ariaLabel="Topology" nodes={nodes} edges={edges} onNodeClick={onNodeClick} />,
    );
    await screen.findByText('frontend');

    // fireEvent rather than user-event: d3-zoom's mousedown handler needs `event.view`, which
    // user-event's synthetic pointer events do not set in jsdom.
    fireEvent.click(screen.getByText('frontend'));
    expect(onNodeClick).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'svc' }));

    fireEvent.keyDown(nodeElement('cluster'), { key: 'Enter' });
    expect(onNodeClick).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'cluster' }));
    expect(onNodeClick).toHaveBeenCalledTimes(2);

    const link = screen.getByRole('link', { name: 'shop' });
    // jsdom cannot navigate and would log it.
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);
    expect(onNodeClick).toHaveBeenCalledTimes(2);
  });

  it('renders node links with the host renderLink', async () => {
    render(
      <FlowGraph
        ariaLabel="Topology"
        nodes={nodes}
        edges={edges}
        renderLink={({ href, children }) => <button data-href={href}>{children} (router)</button>}
      />,
    );

    expect(await screen.findByRole('button', { name: 'shop (router)' })).toHaveAttribute(
      'data-href',
      '/apps/shop',
    );
  });

  it('marks the selected node', async () => {
    render(<FlowGraph ariaLabel="Topology" nodes={nodes} edges={edges} selectedId="svc" />);
    await screen.findByText('frontend');

    expect(nodeElement('svc').querySelector('[data-slot="flow-node"]')).toHaveClass(
      'outline-primary',
    );
    expect(nodeElement('app').querySelector('[data-slot="flow-node"]')).not.toHaveClass(
      'outline-primary',
    );
  });

  it('keeps node positions when only statuses change', async () => {
    const { rerender } = render(<FlowGraph ariaLabel="Topology" nodes={nodes} edges={edges} />);
    await screen.findByText('frontend');
    const before = nodeElement('svc').style.transform;

    // A refetch may also return the same items in another order.
    const recolored = [...nodes]
      .reverse()
      .map((node) => ({ ...node, tone: 'destructive' as const }));
    rerender(<FlowGraph ariaLabel="Topology" nodes={recolored} edges={edges} />);

    expect(nodeElement('svc').style.transform).toBe(before);
    expect(nodeElement('svc').querySelector('[data-slot="flow-node"]')).toHaveClass(
      'border-destructive/60',
    );
  });

  it('fades what is not connected to the hovered node and restores it on leave', async () => {
    const extra: FlowNode[] = [...nodes, { id: 'other', label: 'lonely' }];
    render(<FlowGraph ariaLabel="Topology" nodes={extra} edges={edges} />);
    await screen.findByRole('group', { name: 'Topology' });
    const surface = (id: string) => nodeElement(id).querySelector('[data-slot="flow-node"]');

    fireEvent.mouseEnter(nodeElement('worker'));
    // The worker's edge reaches svc; its group stays too. The app and the loose node fade.
    expect(surface('svc')).not.toHaveClass('opacity-40');
    expect(surface('cluster')).not.toHaveClass('opacity-40');
    expect(surface('app')).toHaveClass('opacity-40');
    expect(surface('other')).toHaveClass('opacity-40');

    fireEvent.mouseLeave(nodeElement('worker'));
    expect(surface('app')).not.toHaveClass('opacity-40');
  });
});

describe('FlowGraph interactions', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const card = (node: FlowNode) => (node.id === 'app' ? null : <span>Card of {node.label}</span>);

  it('opens the hover card after a delay, keeps it through a short grace and closes on leave', async () => {
    render(<FlowGraph ariaLabel="Topology" nodes={nodes} edges={edges} renderHoverCard={card} />);
    await screen.findByRole('group', { name: 'Topology' });
    vi.useFakeTimers();

    fireEvent.mouseEnter(nodeElement('svc'));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByText('Card of frontend')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Card of frontend');

    // Moving straight to a neighbour switches the open card without a new delay.
    fireEvent.mouseLeave(nodeElement('svc'));
    fireEvent.mouseEnter(nodeElement('cluster'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Card of edge-munich');

    fireEvent.mouseLeave(nodeElement('cluster'));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows no card where renderHoverCard returns null', async () => {
    render(<FlowGraph ariaLabel="Topology" nodes={nodes} edges={edges} renderHoverCard={card} />);
    await screen.findByRole('group', { name: 'Topology' });
    vi.useFakeTimers();

    fireEvent.mouseEnter(nodeElement('app'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the card on keyboard focus, closes it on Escape, then clears the selection', async () => {
    const onBackgroundClick = vi.fn();
    render(
      <FlowGraph
        ariaLabel="Topology"
        nodes={nodes}
        edges={edges}
        renderHoverCard={card}
        onBackgroundClick={onBackgroundClick}
      />,
    );
    await screen.findByRole('group', { name: 'Topology' });

    act(() => nodeElement('svc').focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('Card of frontend');

    fireEvent.keyDown(nodeElement('svc'), { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(onBackgroundClick).not.toHaveBeenCalled();

    fireEvent.keyDown(nodeElement('svc'), { key: 'Escape' });
    expect(onBackgroundClick).toHaveBeenCalledOnce();
  });

  it('calls onBackgroundClick for a click on the empty pane', async () => {
    const onBackgroundClick = vi.fn();
    render(
      <FlowGraph
        ariaLabel="Topology"
        nodes={nodes}
        edges={edges}
        onBackgroundClick={onBackgroundClick}
      />,
    );
    await screen.findByRole('group', { name: 'Topology' });

    fireEvent.click(document.querySelector('.react-flow__pane')!);
    expect(onBackgroundClick).toHaveBeenCalledOnce();
  });

  it('traces the selected node while nothing is hovered', async () => {
    const extra: FlowNode[] = [...nodes, { id: 'other', label: 'lonely' }];
    render(<FlowGraph ariaLabel="Topology" nodes={extra} edges={edges} selectedId="app" />);
    await screen.findByRole('group', { name: 'Topology' });
    const surface = (id: string) => nodeElement(id).querySelector('[data-slot="flow-node"]');

    expect(surface('svc')).not.toHaveClass('opacity-40');
    expect(surface('other')).toHaveClass('opacity-40');
    expect(surface('cluster')).toHaveClass('opacity-40');

    // Hover wins while it lasts.
    fireEvent.mouseEnter(nodeElement('other'));
    expect(surface('other')).not.toHaveClass('opacity-40');
    expect(surface('app')).toHaveClass('opacity-40');
    fireEvent.mouseLeave(nodeElement('other'));
    expect(surface('other')).toHaveClass('opacity-40');
  });
});

describe('arrowHead', () => {
  it('puts the tip on the last route point and points along the last stretch', () => {
    const head = arrowHead(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      { x: 0, y: 0 },
      Position.Left,
    );
    expect(head).toBe('M 100 0 L 93 4 L 93 -4 Z');
  });

  it('enters through the handle side without a route', () => {
    expect(arrowHead(null, { x: 50, y: 10 }, Position.Top)).toBe('M 50 10 L 46 3 L 54 3 Z');
  });
});
