import * as React from 'react';
import { cn } from '../lib/utils';

interface PageHeaderProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons and menus aligned to the right of the title (wrapping below it on small screens). */
  actions?: React.ReactNode;
}

function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn('flex flex-wrap items-start justify-between gap-3', className)}
      {...props}
    >
      <div className="min-w-0 space-y-0.5">
        <h1 className="text-xl leading-7 font-semibold tracking-[-0.012em]">{title}</h1>
        {description ? (
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export { PageHeader };
export type { PageHeaderProps };
