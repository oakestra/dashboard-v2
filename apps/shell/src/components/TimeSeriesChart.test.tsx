import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TimeSeriesChart } from './TimeSeriesChart';

const data = [
  { timestamp: new Date('2026-03-01T10:00:00Z'), value: 10 },
  { timestamp: new Date('2026-03-01T10:05:00Z'), value: 42.5 },
];

describe('TimeSeriesChart', () => {
  it.each(['area', 'line'] as const)('renders a %s chart with an accessible name', (variant) => {
    const { container } = render(
      <TimeSeriesChart title="CPU usage" unit="percent" variant={variant} data={data} />,
    );
    expect(screen.getByRole('img', { name: 'CPU usage, latest value 42.5%' })).toBeInTheDocument();
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull();
  });

  it('formats the label with the given unit and handles empty data', () => {
    const { rerender } = render(
      <TimeSeriesChart
        title="Memory"
        unit="bytes"
        data={[{ timestamp: new Date(), value: 2048 }]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Memory, latest value 2 KB' })).toBeInTheDocument();

    rerender(<TimeSeriesChart title="Memory" data={[]} showTitle />);
    expect(screen.getByRole('img', { name: 'Memory, no data' })).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeVisible();
  });
});
