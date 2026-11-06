import * as React from 'react';
import { cn } from '../lib/utils';
import { Badge } from './badge';

/**
 * What a state means to the person looking at it, not what the backend calls it. Features map
 * their own states onto these so the same meaning gets the same color on every page:
 *
 * - `success`: running and healthy, nothing to do (RUNNING, active cluster, active addon).
 * - `warning`: works but degraded, or needs attention soon (partially active, high usage).
 * - `info`: in progress or waiting on the system (REQUESTED, SCHEDULED, installing). Pair with
 *   `pulse` while it is actively changing.
 * - `destructive`: failed or broken, someone has to act (FAILED, DEAD).
 * - `neutral`: no judgement: stopped on purpose, disabled, unknown, not deployed.
 *
 * Features decide the mapping, so the lists above are examples, not a contract: the shell maps
 * NO_WORKER_CAPACITY and an inactive cluster to `warning`.
 */
type StatusTone = 'success' | 'warning' | 'info' | 'destructive' | 'neutral';

/**
 * Each tone has its own shape so that status does not depend on color vision: disc for healthy,
 * triangle for degraded, square for failed, ring for in progress, dash for neutral.
 */
const GLYPH: Readonly<Record<StatusTone, string>> = {
  success: 'rounded-full bg-success',
  warning: 'bg-warning [clip-path:polygon(50%_4%,100%_96%,0_96%)]',
  info: 'rounded-full border-2 border-info',
  destructive: 'rounded-[1px] bg-destructive',
  neutral: 'my-auto h-0.5! rounded-full bg-muted-foreground/70',
};

/**
 * Hatched background for "last known value, no recent report". Not a tone: the state still has a
 * meaning, we just cannot confirm it. The stripes mix `currentColor`, so they follow the text color
 * in both themes without a token. Exported so table cells can reuse the same hatch.
 */
const staleSurfaceClassName =
  'bg-[repeating-linear-gradient(135deg,transparent_0_3px,color-mix(in_oklab,currentColor_14%,transparent)_3px_4px)]';

const STALE_GLYPH = 'rounded-full border-2 border-dashed border-muted-foreground';

interface StatusDotProps extends React.ComponentProps<'span'> {
  tone: StatusTone;
  /** Last known state without a recent report: dashed ring instead of the tone's glyph. */
  stale?: boolean;
  /** Pulses the glyph, for states that are changing right now. */
  pulse?: boolean;
}

/** The bare status glyph, for dense places (table cells, lists) next to a text label. */
function StatusDot({ tone, stale = false, pulse = false, className, ...props }: StatusDotProps) {
  return (
    <span
      aria-hidden
      data-slot="status-dot"
      data-tone={tone}
      data-stale={stale || undefined}
      className={cn('inline-flex size-2 shrink-0', className)}
      {...props}
    >
      <span
        className={cn(
          'inline-flex size-full',
          stale ? STALE_GLYPH : GLYPH[tone],
          pulse && 'animate-pulse motion-reduce:animate-none',
        )}
      />
    </span>
  );
}

interface StatusBadgeProps extends React.ComponentProps<'span'> {
  tone: StatusTone;
  /**
   * Last known state, no recent report: muted text, dashed ring glyph and a hatched background.
   * The tone is kept for `data-tone` but its fill and color are dropped.
   */
  stale?: boolean;
  /** Leading glyph; on by default. Ignored when `icon` is set. */
  dot?: boolean;
  /** Replaces the glyph, e.g. a spinner for transitional states. */
  icon?: React.ReactNode;
  /** Pulses the glyph, for states that are changing right now. */
  pulse?: boolean;
}

/**
 * A status label: glyph plus text. Only `warning` and `destructive` get a background fill, the
 * other tones are plain text.
 */
function StatusBadge({
  tone,
  stale = false,
  dot = true,
  icon,
  pulse = false,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge
      variant={tone}
      data-tone={tone}
      data-stale={stale || undefined}
      className={cn(
        'gap-1.5',
        stale && ['text-muted-foreground', staleSurfaceClassName],
        className,
      )}
      {...props}
    >
      {icon ?? (dot ? <StatusDot tone={tone} stale={stale} pulse={pulse} /> : null)}
      {children}
    </Badge>
  );
}

export { StatusBadge, StatusDot, staleSurfaceClassName };
export type { StatusBadgeProps, StatusDotProps, StatusTone };
