import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Fact, FactList } from './fact-list';
import { InspectorPanel, InspectorSection } from './inspector-panel';

describe('InspectorPanel', () => {
  it('is a region named after its title, closed by its close button', async () => {
    const onClose = vi.fn();
    render(
      <InspectorPanel kind="Cluster" title="edge-munich" onClose={onClose}>
        body
      </InspectorPanel>,
    );
    const region = screen.getByRole('region', { name: 'Details of edge-munich' });
    expect(screen.getByRole('heading', { level: 2, name: 'edge-munich' })).toBeVisible();
    expect(region).toHaveTextContent('Cluster');
    await userEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('takes the name from `name` when the title is markup', () => {
    render(
      <InspectorPanel
        title={<span className="font-mono">a1b2c3</span>}
        name="a1b2c3"
        onClose={vi.fn()}
      >
        body
      </InspectorPanel>,
    );
    expect(screen.getByRole('region', { name: 'Details of a1b2c3' })).toBeInTheDocument();
  });

  it('falls back to the heading for its name when the title is markup without a name', () => {
    render(
      <InspectorPanel title={<span>a1b2c3</span>} onClose={vi.fn()}>
        body
      </InspectorPanel>,
    );
    expect(screen.getByRole('region', { name: 'a1b2c3' })).toBeInTheDocument();
  });

  it('puts section headings one level below the title', () => {
    render(
      <InspectorPanel title="api" headingLevel={3} onClose={vi.fn()}>
        <InspectorSection title="Instances">rows</InspectorSection>
      </InspectorPanel>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'api' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Instances' })).toBeInTheDocument();
  });

  it('renders the footer only when there is one', () => {
    const { container, rerender } = render(
      <InspectorPanel title="api" onClose={vi.fn()}>
        body
      </InspectorPanel>,
    );
    expect(container.querySelector('.border-t')).toBeNull();
    rerender(
      <InspectorPanel title="api" onClose={vi.fn()} footer={<a href="/x">Open service</a>}>
        body
      </InspectorPanel>,
    );
    expect(screen.getByRole('link', { name: 'Open service' }).parentElement).toHaveClass(
      'border-t',
    );
  });
});

describe('Fact', () => {
  it('leaves out rows without a value', () => {
    render(
      <FactList>
        <Fact label="Workers">{0}</Fact>
        <Fact label="Location">{undefined}</Fact>
        <Fact label="Runtimes">{''}</Fact>
      </FactList>,
    );
    expect(screen.getByRole('term')).toHaveTextContent('Workers');
    expect(screen.getByRole('definition')).toHaveTextContent('0');
  });
});
