import * as React from 'react';
import { cn } from '../lib/utils';

interface EmptyStateProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Usually a Button; rendered below the description. */
  action?: React.ReactNode;
}

function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 rounded-lg px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          aria-hidden
          className="mb-1 text-muted-foreground/70 [&_svg]:stroke-[1.5] [&_svg:not([class*='size-'])]:size-6"
        >
          {icon}
        </div>
      ) : null}
      <h3 className="font-semibold">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-pretty text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
