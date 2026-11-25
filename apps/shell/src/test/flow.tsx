import { FlowGraph } from '@oakestra/ui/flow';
import { render, waitFor } from '@testing-library/react';
import { expect } from 'vitest';

export const FLOW_PRELOAD_TIMEOUT = 15_000;

// FlowGraph is lazy, and the first import in a worker has Vite transform React Flow and dagre.
// That can take over a second when all packages run their tests in parallel, so load it once in
// beforeAll instead of in whichever test happens to render a graph first.
export async function preloadFlowGraph() {
  const { container, unmount } = render(
    <FlowGraph ariaLabel="preload" nodes={[{ id: 'preload', label: 'preload' }]} edges={[]} />,
  );
  await waitFor(() => expect(container.querySelector('.react-flow')).not.toBeNull(), {
    timeout: 10_000,
  });
  unmount();
}
