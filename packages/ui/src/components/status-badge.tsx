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

const DOT_COLOR: Readonly<Record<StatusTone, string>> = {
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  destructive: 'bg-destructive',
  neutral: 'bg-muted-foreground/60',
};

interface StatusDotProps extends React.ComponentProps<'span'> {
  tone: StatusTone;
  /** Animates a halo around the dot, for states that are changing right now. */
  pulse?: boolean;
}

/** The bare colored dot, for dense places (table cells, lists) next to a text label. */
function StatusDot({ tone, pulse = false, className, ...props }: StatusDotProps) {
  return (
    <span
      aria-hidden
      data-slot="status-dot"
      data-tone={tone}
      className={cn('relative inline-flex size-1.5 shrink-0', className)}
      {...props}
    >
      {pulse ? (
        <span
          className={cn(
            'absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden',
            DOT_COLOR[tone],
          )}
        />
      ) : null}
      <span className={cn('relative inline-flex size-full rounded-full', DOT_COLOR[tone])} />
    </span>
  );
}

interface StatusBadgeProps extends React.ComponentProps<'span'> {
  tone: StatusTone;
  /** Leading dot; on by default. Ignored when `icon` is set. */
  dot?: boolean;
  /** Replaces the dot, e.g. a spinner for transitional states. */
  icon?: React.ReactNode;
  /** Pulses the dot, for states that are changing right now. */
  pulse?: boolean;
}

/** A soft, tinted badge for a status label. The text is the label; color is never the only cue. */
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
