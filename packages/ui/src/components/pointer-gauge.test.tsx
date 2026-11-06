import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PointerGauge } from './pointer-gauge';

describe('PointerGauge', () => {
  it('names the measurement with its value', () => {
    render(<PointerGauge value={42} label="CPU" valueLabel="42%" />);
    expect(screen.getByRole('img', { name: 'CPU: 42%' })).not.toHaveAttribute('data-abnormal');
  });

  it('turns abnormal past normalMax and clamps the pointer, not the text', () => {
    const { container } = render(<PointerGauge value={140} label="CPU" />);
    expect(screen.getByRole('img', { name: 'CPU: 140' })).toHaveAttribute('data-abnormal', 'true');
    const pointer = container.querySelector<HTMLElement>('.bg-warning');
    expect(pointer?.style.left).toBe('100%');
    expect(container.querySelector('.text-warning')).toHaveTextContent('140');
  });

  it('is not abnormal exactly at normalMax', () => {
    render(<PointerGauge value={70} label="CPU" />);
    expect(screen.getByRole('img')).not.toHaveAttribute('data-abnormal');
  });

  it('shows "No data" without a pointer for null', () => {
    const { container } = render(<PointerGauge value={null} label="CPU" />);
    expect(screen.getByRole('img', { name: 'CPU: no data' })).toHaveTextContent('No data');
    expect(container.querySelector('.bg-foreground')).toBeNull();
  });
});
