import * as React from 'react';
import { cn } from '../lib/utils';

/** A keyboard hint such as `⌘K`. Decorative text: put the real shortcut in `aria-keyshortcuts`. */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none',
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
