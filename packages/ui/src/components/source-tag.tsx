import * as React from 'react';
import { cn } from '../lib/utils';

interface SourceTagProps extends React.ComponentProps<'span'> {
  /** Name of the provider, e.g. an addon id. Ignored when `children` is set. */
  name?: string;
  version?: string;
}

/**
 * Marks where something comes from (an addon, say). Always a plain span: it sits inside tab
 * triggers, where a nested button or link is invalid. The dashed hairline keeps it reading as
 * provenance, not as a status or an action.
 */
function SourceTag({ name, version, className, children, ...props }: SourceTagProps) {
  return (
    <span
      data-slot="source-tag"
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 rounded-sm border border-dashed border-border px-1 py-px text-xs leading-none whitespace-nowrap text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          {name}
          {version ? <span className="tabular-nums">v{version}</span> : null}
        </>
      )}
    </span>
  );
}

export { SourceTag };
export type { SourceTagProps };
