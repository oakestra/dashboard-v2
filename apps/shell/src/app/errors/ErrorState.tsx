import { cn } from '@oakestra/ui';
import type { ReactNode } from 'react';

/**
 * Message block shared by the 404, route error and config error pages. It may render inside the
 * app layout or on a bare page, so it sizes itself to the space it gets instead of assuming a
 * full viewport.
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
  icon?: ReactNode;
  /** HTTP status or similar, shown next to the title when it tells the reader something. */
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
    <div className={cn('px-4 py-10', className)} {...props}>
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center gap-2">
          {icon ? (
            <span
              aria-hidden
              className={cn(
                'shrink-0 [&_svg]:size-4',
                tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {icon}
            </span>
          ) : null}
          <h1 className="text-base font-semibold text-balance">{title}</h1>
          {code !== undefined ? (
            <span className="text-muted-foreground text-sm tabular-nums">{code}</span>
          ) : null}
        </div>
        {children ? (
          <div className="text-muted-foreground mt-2 text-sm text-pretty break-words">
            {children}
          </div>
        ) : null}
        {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
