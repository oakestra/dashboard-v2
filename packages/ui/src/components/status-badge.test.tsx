import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders the label with a soft tone variant and a leading dot', () => {
    render(<StatusBadge tone="destructive">Failed</StatusBadge>);
    const badge = screen.getByText('Failed');
    expect(badge).toHaveAttribute('data-tone', 'destructive');
    expect(badge).toHaveAttribute('data-variant', 'destructive');
    expect(badge.querySelector('[data-slot="status-dot"]')).not.toBeNull();
  });

  it('replaces the dot with an icon or drops it', () => {
    const { rerender } = render(
      <StatusBadge tone="info" icon={<svg data-testid="spinner" />}>
        Installing
      </StatusBadge>,
    );
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="status-dot"]')).toBeNull();

    rerender(
      <StatusBadge tone="neutral" dot={false}>
        Disabled
      </StatusBadge>,
    );
    expect(document.querySelector('[data-slot="status-dot"]')).toBeNull();
  });
});
