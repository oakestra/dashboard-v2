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
 * - `destructive`: failed or broken, someone has to act (FAILED, DEAD, NO_WORKER_CAPACITY).
 * - `neutral`: no judgement: stopped on purpose, inactive, disabled, unknown, not deployed.
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

interface StatusDotProps extends React.ComponentProps<'span'> {
  tone: StatusTone;
  /** Pulses the glyph, for states that are changing right now. */
  pulse?: boolean;
}

/** The bare status glyph, for dense places (table cells, lists) next to a text label. */
function StatusDot({ tone, pulse = false, className, ...props }: StatusDotProps) {
  return (
    <span
      aria-hidden
      data-slot="status-dot"
      data-tone={tone}
      className={cn('inline-flex size-2 shrink-0', className)}
      {...props}
    >
      <span
        className={cn(
          'inline-flex size-full',
          GLYPH[tone],
          pulse && 'animate-pulse motion-reduce:animate-none',
        )}
      />
    </span>
  );
}

interface StatusBadgeProps extends React.ComponentProps<'span'> {
  tone: StatusTone;
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
  dot = true,
  icon,
  pulse = false,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge variant={tone} data-tone={tone} className={cn('gap-1.5', className)} {...props}>
      {icon ?? (dot ? <StatusDot tone={tone} pulse={pulse} /> : null)}
      {children}
    </Badge>
  );
}

export { StatusBadge, StatusDot };
export type { StatusBadgeProps, StatusDotProps, StatusTone };
