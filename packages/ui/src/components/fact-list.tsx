import * as React from 'react';
import { cn } from '../lib/utils';

/** Label and value pairs in two aligned columns. Put `Fact`s inside, nothing else. */
function FactList({ className, ...props }: React.ComponentProps<'dl'>) {
  return (
    <dl
      data-slot="fact-list"
      className={cn('grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm', className)}
      {...props}
    />
  );
}

interface FactProps {
  label: React.ReactNode;
  /** The value. `undefined`, `null` and `''` leave the whole row out, so callers need no guard. */
  children?: React.ReactNode;
}

/** One row of a `FactList`. */
function Fact({ label, children }: FactProps) {
  if (children === undefined || children === null || children === '') return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 wrap-break-word">{children}</dd>
    </>
  );
}

export { Fact, FactList };
export type { FactProps };
