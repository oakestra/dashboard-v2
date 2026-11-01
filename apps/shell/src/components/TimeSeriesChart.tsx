import {
  Area,
  AreaChart,
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  XAxis,
  YAxis,
  type ChartConfig,
} from '@oakestra/ui/chart';
import { cn } from '@oakestra/ui';

import { formatBytes, formatPercent } from '../lib/format';

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
}

export type TimeSeriesUnit = 'percent' | 'bytes' | 'number';

const formatters: Record<TimeSeriesUnit, (value: number) => string> = {
  percent: (value) => formatPercent(value, 1),
  bytes: (value) => formatBytes(value, 1),
  number: (value) => value.toLocaleString(),
};

interface TimeSeriesChartProps {
  data: readonly TimeSeriesPoint[];
  /** Used as the accessible name and, with `showTitle`, as a visible caption. */
  title: string;
  /** Picks tick and tooltip formatting. A function overrides it. */
  unit?: TimeSeriesUnit | ((value: number) => string);
  variant?: 'line' | 'area';
  /** Series color; defaults to the theme's first chart color. */
  color?: string;
  showTitle?: boolean;
  className?: string;
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

export function TimeSeriesChart({
  data,
  title,
  unit = 'number',
  variant = 'area',
  color = 'var(--chart-1)',
  showTitle = false,
  className,
}: TimeSeriesChartProps) {
  const format = typeof unit === 'function' ? unit : formatters[unit];
  // Recharts wants a numeric x value to scale a time axis properly.
  const points = data.map((point) => ({ time: point.timestamp.getTime(), value: point.value }));
  const config = { value: { label: title, color } } satisfies ChartConfig;
  const last = points.at(-1);

  const axes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis
        dataKey="time"
        type="number"
        scale="time"
        domain={['dataMin', 'dataMax']}
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        minTickGap={32}
        tickFormatter={(value: number) => timeFormat.format(value)}
      />
      <YAxis
        width={64}
        tickLine={false}
        axisLine={false}
        tickMargin={4}
        tickFormatter={(value: number) => format(value)}
      />
      <ChartTooltip
        content={
          <ChartTooltipContent
            hideIndicator
            labelFormatter={(_label, payload) => {
              const time = payload[0]?.payload?.time;
              return typeof time === 'number' ? dateTimeFormat.format(time) : '';
            }}
            formatter={(value, name) => (
              <div className="flex w-full justify-between gap-4">
                <span className="text-muted-foreground">
                  {config[name as 'value']?.label ?? name}
                </span>
                <span className="font-mono font-medium tabular-nums">{format(Number(value))}</span>
              </div>
            )}
          />
        }
      />
    </>
  );

  return (
    <figure
      className={cn('space-y-2', className)}
      role="img"
      aria-label={last ? `${title}, latest value ${format(last.value)}` : `${title}, no data`}
    >
      {showTitle ? <figcaption className="text-sm font-medium">{title}</figcaption> : null}
      <ChartContainer
        config={config}
        className="aspect-auto h-56 w-full"
        initialDimension={{ width: 600, height: 224 }}
      >
        {variant === 'line' ? (
          <LineChart data={points} margin={{ left: 4, right: 8, top: 4 }}>
            {axes}
            <Line
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        ) : (
          <AreaChart data={points} margin={{ left: 4, right: 8, top: 4 }}>
            {axes}
            <Area
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              fill="var(--color-value)"
              fillOpacity={0.2}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </ChartContainer>
    </figure>
  );
}
