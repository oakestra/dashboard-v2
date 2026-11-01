import { cn } from '@oakestra/ui';
import type { ReactNode } from 'react';

/**
 * Centered message block shared by the 404, route error and config error pages. It may render
 * inside the app layout or on a bare page, so it centers itself in the space it gets instead of
 * assuming a full viewport.
 */
export function ErrorState({
  icon,
  code,
  title,
  children,
  actions,
  tone = 'neutral',
  className,
  ...props
}: {
  icon: ReactNode;
  /** HTTP status or similar, shown small above the title when it tells the reader something. */
  code?: string | number;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: 'neutral' | 'destructive';
  className?: string;
  role?: string;
  'data-testid'?: string;
}) {
  return (
    <div
      className={cn('flex min-h-[60vh] items-center justify-center px-4 py-12', className)}
      {...props}
    >
      <div className="flex w-full max-w-lg flex-col items-center text-center">
        <div
          aria-hidden
          className={cn(
            'mb-5 flex size-12 items-center justify-center rounded-xl border shadow-xs [&_svg]:size-6',
            tone === 'destructive'
              ? 'border-destructive/20 bg-destructive/10 text-destructive'
              : 'bg-card text-muted-foreground',
          )}
        >
          {icon}
        </div>
        {code !== undefined ? (
          <p className="text-muted-foreground mb-1 font-mono text-sm tabular-nums">{code}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {children ? (
          <div className="text-muted-foreground mt-2 text-sm text-pretty break-words">
            {children}
          </div>
        ) : null}
        {actions ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
