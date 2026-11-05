import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TimeSeriesChart, timeTicks, byteTicks } from './time-series-chart';

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

  it('picks round, uniquely labelled ticks for short and long windows', () => {
    const start = Date.parse('2026-03-01T10:20:10Z');

    const short = timeTicks(start, start + 3 * 60_000);
    expect(short.ticks.length).toBeGreaterThan(1);
    expect(short.ticks.length).toBeLessThanOrEqual(5);
    expect(new Set(short.ticks.map(short.format)).size).toBe(short.ticks.length);
    for (const tick of short.ticks) expect(tick % 60_000).toBe(0);

    const seconds = timeTicks(start, start + 40_000);
    expect(new Set(seconds.ticks.map(seconds.format)).size).toBe(seconds.ticks.length);

    const week = timeTicks(start, start + 7 * 86_400_000);
    expect(week.ticks.length).toBeLessThanOrEqual(5);
    expect(new Set(week.ticks.map(week.format)).size).toBe(week.ticks.length);

    expect(timeTicks(start, start).ticks).toEqual([start]);
  });
});

describe('byteTicks', () => {
  const MB = 1024 ** 2;

  it('lands on round binary values that cover the maximum', () => {
    expect(byteTicks(7.4 * MB)).toEqual([0, 2 * MB, 4 * MB, 6 * MB, 8 * MB]);
  });

  it('leaves an all-zero series to the chart', () => {
    expect(byteTicks(0)).toBeUndefined();
  });
});
