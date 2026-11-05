import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge, StatusDot } from './status-badge';

describe('StatusBadge', () => {
  it('renders the label with its tone variant and a leading glyph', () => {
    render(<StatusBadge tone="destructive">Failed</StatusBadge>);
    const badge = screen.getByText('Failed');
    expect(badge).toHaveAttribute('data-tone', 'destructive');
    expect(badge).toHaveAttribute('data-variant', 'destructive');
    expect(badge.querySelector('[data-slot="status-dot"]')).not.toBeNull();
  });

  it('gives every tone its own glyph, so status does not rest on color alone', () => {
    const tones = ['success', 'warning', 'info', 'destructive', 'neutral'] as const;
    const { container } = render(
      <>
        {tones.map((tone) => (
          <StatusDot key={tone} tone={tone} />
        ))}
      </>,
    );
    const glyphs = [...container.querySelectorAll('[data-slot="status-dot"] > span')].map(
      (glyph) => glyph.className,
    );
    expect(new Set(glyphs).size).toBe(tones.length);
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
