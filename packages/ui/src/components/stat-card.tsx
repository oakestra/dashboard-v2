import * as React from 'react';
import { cn } from '../lib/utils';
import { Skeleton } from './skeleton';
import type { StatusTone } from './status-badge';

// Only abnormal values take a color, see the palette notes in styles.css.
const VALUE_TONE: Readonly<Record<StatusTone | 'default', string | undefined>> = {
  default: undefined,
  success: undefined,
  info: undefined,
  neutral: 'text-muted-foreground',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** A lucide icon element; shown small and muted next to the label. */
  icon?: React.ReactNode;
  /** One short muted line below the value ("3 active nodes"). */
  hint?: React.ReactNode;
  /** Colors the value when it is abnormal, e.g. `destructive` for a non-zero failure count. */
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
 * A compact readout: label on top, the value below in tabular figures, an optional hint. It fills
 * its grid cell, so tiles in one row share a height whether or not they have a hint. Put related
 * readouts in a `StatGroup`, on its own a tile has a frame of its own.
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
    'flex h-full min-w-0 flex-col gap-1 rounded-lg border bg-card px-5 py-4 text-left text-card-foreground shadow-xs',
    // In a group the cells share the group's frame. The lines between them are shadows, which the
    // group clips at its edge. Borders would need to know each cell's position in the grid, and
    // that is not known here: tiles come from addons and rows wrap.
    'in-data-[slot=stat-group]:rounded-none in-data-[slot=stat-group]:border-0 in-data-[slot=stat-group]:bg-transparent in-data-[slot=stat-group]:shadow-[1px_0_0_var(--border),0_1px_0_var(--border)]',
    interactive &&
      'cursor-pointer outline-none hover:bg-accent/60 in-data-[slot=stat-group]:hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
    className,
  );

  const content = (
    <>
      {/* Spans, not divs: the card may render as a <button>, which only takes phrasing content. */}
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon ? (
          <span aria-hidden className='shrink-0 [&_svg:not([class*="size-"])]:size-3.5'>
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 truncate text-sm">{label}</span>
      </span>
      {loading ? (
        <>
          <Skeleton data-testid="stat-card-skeleton" className="mt-1 block h-7 w-16" />
          {hint !== undefined ? <Skeleton className="mt-1 block h-3.5 w-28" /> : null}
        </>
      ) : (
        <>
          <span
            className={cn(
              'text-3xl leading-9 font-semibold tracking-tight tabular-nums',
              VALUE_TONE[tone],
            )}
          >
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

/**
 * Joins `StatCard`s into one frame. Up to the `lg` breakpoint the cells wrap two per
 * row, from there they share a single row however many there are, so a tile a preset leaves out
 * does not leave a hole. Pass `grid-cols-*` in `className` for a fixed layout.
 */
function StatGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="stat-group"
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-lg border bg-card shadow-xs lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none',
        className,
      )}
      {...props}
    />
  );
}

export { StatCard, StatGroup };
export type { StatCardProps };
