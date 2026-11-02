import * as React from 'react';
import { cn } from '../lib/utils';
import { Skeleton } from './skeleton';
import type { StatusTone } from './status-badge';

const ICON_TONE: Readonly<Record<StatusTone | 'default', string>> = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  destructive: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
};

interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** A lucide icon element; shown top right in a small tinted square. */
  icon?: React.ReactNode;
  /** One short muted line below the value ("3 active nodes"). */
  hint?: React.ReactNode;
  /** Tints the icon, e.g. `destructive` for a non-zero failure count. */
  tone?: StatusTone | 'default';
  /** Shows skeletons for value and hint instead of the content. */
  loading?: boolean;
  /** Renders the card as a plain link. Use `asChild` with the router's Link for in-app routes. */
  href?: string;
  /** Renders the card as a button. */
  onClick?: React.MouseEventHandler<HTMLElement>;
  /**
   * Renders the card into the single child element instead of a div, e.g.
   * `<StatCard asChild ...><Link to="/applications" /></StatCard>`. The child's own children are
   * replaced by the card content.
   */
  asChild?: boolean;
  children?: React.ReactElement<{ className?: string; children?: React.ReactNode }>;
  className?: string;
}

/**
 * A compact metric tile: label and icon on top, the value below in tabular figures, an optional
 * hint. It fills its grid cell, so tiles in one row share a height whether or not they have a
 * hint.
 */
function StatCard({
  label,
  value,
  icon,
  hint,
  tone = 'default',
  loading = false,
  href,
  onClick,
  asChild = false,
  children,
  className,
}: StatCardProps) {
  const interactive = asChild || href !== undefined || onClick !== undefined;
  const classes = cn(
    'flex h-full min-w-0 flex-col gap-1 rounded-xl border bg-card p-4 text-left text-card-foreground shadow-xs',
    interactive &&
      'cursor-pointer transition-colors outline-none hover:border-primary/30 hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
    className,
  );

  const content = (
    <>
      {/* Spans, not divs: the card may render as a <button>, which only takes phrasing content. */}
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-muted-foreground">{label}</span>
        {icon ? (
          <span
            aria-hidden
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md [&_svg:not([class*="size-"])]:size-4',
              ICON_TONE[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </span>
      {loading ? (
        <>
          <Skeleton data-testid="stat-card-skeleton" className="mt-1 block h-7 w-16" />
          {hint !== undefined ? <Skeleton className="mt-1 block h-3.5 w-28" /> : null}
        </>
      ) : (
        <>
          <span className="text-2xl leading-tight font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          {hint !== undefined && hint !== null ? (
            <span className="truncate text-xs text-muted-foreground">{hint}</span>
          ) : null}
        </>
      )}
    </>
  );

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      className: cn(classes, children.props.className),
      'data-slot': 'stat-card',
      'aria-busy': loading || undefined,
      children: content,
    } as React.HTMLAttributes<HTMLElement>);
  }
  if (href !== undefined) {
    return (
      <a
        data-slot="stat-card"
        href={href}
        onClick={onClick}
        aria-busy={loading || undefined}
        className={classes}
      >
        {content}
      </a>
    );
  }
  if (onClick !== undefined) {
    return (
      <button
        type="button"
        data-slot="stat-card"
        onClick={onClick}
        aria-busy={loading || undefined}
        className={classes}
      >
        {content}
      </button>
    );
  }
  return (
    <div data-slot="stat-card" aria-busy={loading || undefined} className={classes}>
      {content}
    </div>
  );
}

export { StatCard };
export type { StatCardProps };
