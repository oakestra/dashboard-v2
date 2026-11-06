import * as React from 'react';
import { cn } from '../lib/utils';

interface PointerGaugeProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  /** The measured value, or `null` when there is none. */
  value: number | null;
  /** End of the track. */
  max?: number;
  /** Upper end of the normal band. Above it the pointer and the value use `warning`. */
  normalMax?: number;
  /** Accessible name of what is measured, e.g. "CPU". */
  label: string;
  /** Text next to the track instead of the plain value, e.g. "42%". */
  valueLabel?: string;
  size?: 'sm' | 'md';
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * A thin track with the normal band shaded and a pointer at the current value, in the style of a
 * high-performance HMI: at rest nothing stands out, and a pointer outside the band is the cue.
 * The pointer is clamped to the track, the text keeps the real value.
 */
function PointerGauge({
  value,
  max = 100,
  normalMax = 70,
  label,
  valueLabel,
  size = 'md',
  className,
  ...props
}: PointerGaugeProps) {
  const hasValue = value !== null && Number.isFinite(value) && max > 0;
  const text = valueLabel ?? (hasValue ? String(value) : '');
  const abnormal = hasValue && value > normalMax;
  const bandPct = clamp((normalMax / max) * 100, 0, 100);
  const pointerPct = hasValue ? clamp((value / max) * 100, 0, 100) : 0;

  return (
    <div
      role="img"
      aria-label={hasValue ? `${label}: ${text}` : `${label}: no data`}
      data-slot="pointer-gauge"
      data-abnormal={abnormal || undefined}
      className={cn('flex items-center gap-2', size === 'sm' ? 'text-xs' : 'text-sm', className)}
      {...props}
    >
      {hasValue ? (
        <>
          <div
            aria-hidden
            className={cn(
              'relative min-w-12 flex-1 rounded-sm bg-foreground/5',
              size === 'sm' ? 'h-1.5' : 'h-2',
            )}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-sm bg-foreground/10"
              style={{ width: `${bandPct}%` }}
            />
            <div
              className={cn(
                'absolute -top-0.5 -bottom-0.5 w-0.5 -translate-x-1/2 rounded-full',
                abnormal ? 'bg-warning' : 'bg-foreground',
              )}
              style={{ left: `${pointerPct}%` }}
            />
          </div>
          <span
            aria-hidden
            className={cn(
              'shrink-0 tabular-nums',
              abnormal ? 'font-medium text-warning' : 'text-foreground',
            )}
          >
            {text}
          </span>
        </>
      ) : (
        <span aria-hidden className="text-muted-foreground">
          No data
        </span>
      )}
    </div>
  );
}

export { PointerGauge };
export type { PointerGaugeProps };
