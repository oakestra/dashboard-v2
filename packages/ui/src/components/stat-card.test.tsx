import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StatCard } from './stat-card';

describe('StatCard', () => {
  it('shows label, value and hint', () => {
    render(<StatCard label="Clusters" value={3} hint="2 active" />);
    expect(screen.getByText('Clusters')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2 active')).toBeInTheDocument();
  });

  it('shows a skeleton instead of the value while loading', () => {
    render(<StatCard label="Clusters" value={3} loading />);
    expect(screen.getByTestId('stat-card-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('renders as a link, a button or into a child element', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<StatCard label="Apps" value={1} href="/apps" />);
    expect(screen.getByRole('link', { name: /Apps/ })).toHaveAttribute('href', '/apps');

    rerender(<StatCard label="Apps" value={1} onClick={onClick} />);
    await user.click(screen.getByRole('button', { name: /Apps/ }));
    expect(onClick).toHaveBeenCalled();

    rerender(
      <StatCard label="Apps" value={1} asChild>
        {/* eslint-disable-next-line jsx-a11y/anchor-has-content -- StatCard renders into it */}
        <a href="/router-link" className="extra" />
      </StatCard>,
    );
    const link = screen.getByRole('link', { name: /Apps/ });
    expect(link).toHaveAttribute('href', '/router-link');
    expect(link).toHaveClass('extra');
    expect(link).toHaveAttribute('data-slot', 'stat-card');
  });
});
