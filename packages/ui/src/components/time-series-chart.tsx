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
} from './chart';
import { useId } from 'react';

import { formatBytes, formatPercent } from '../lib/format';
import { cn } from '../lib/utils';

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

const secondFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const minuteFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TICK_STEPS = [
  5 * SECOND,
  15 * SECOND,
  30 * SECOND,
  MINUTE,
  2 * MINUTE,
  5 * MINUTE,
  10 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
];
const MAX_TICKS = 5;

/**
 * Ticks on round multiples of one step, with a label precise enough for that step. Letting
 * Recharts pick ticks on a time scale and printing them as HH:MM repeats a label ("10:20, 10:20")
 * whenever the data spans only a few minutes.
 */
export function timeTicks(
  min: number,
  max: number,
): { ticks: number[]; format: (time: number) => string } {
  const span = max - min;
  const step =
    TICK_STEPS.find((candidate) => span / candidate <= MAX_TICKS) ??
    Math.ceil(span / MAX_TICKS / DAY) * DAY;
  const format =
    step < MINUTE
      ? (time: number) => secondFormat.format(time)
      : step < DAY
        ? (time: number) => minuteFormat.format(time)
        : (time: number) => dayFormat.format(time);
  if (span <= 0) return { ticks: [min], format };
  const ticks: number[] = [];
  for (let tick = Math.ceil(min / step) * step; tick <= max; tick += step) ticks.push(tick);
  return { ticks, format };
}
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
  // SVG gradient ids are document-global, so every chart needs its own.
  const gradientId = `ts-fill-${useId().replace(/:/g, '')}`;
  // Recharts wants a numeric x value to scale a time axis properly.
  const points = data.map((point) => ({ time: point.timestamp.getTime(), value: point.value }));
  const config = { value: { label: title, color } } satisfies ChartConfig;
  const last = points.at(-1);
  const { ticks, format: formatTick } = timeTicks(points.at(0)?.time ?? 0, last?.time ?? 0);

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
        ticks={ticks}
        minTickGap={24}
        tickFormatter={(value: number) => formatTick(value)}
      />
      <YAxis
        // Recharts wraps tick labels that do not fit; 72px keeps "976.6 KB" on one line.
        width={72}
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
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {axes}
            <Area
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              fill={`url(#${gradientId})`}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </ChartContainer>
    </figure>
  );
}
