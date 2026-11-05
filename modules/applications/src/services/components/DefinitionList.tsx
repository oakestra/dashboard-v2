import type { ReactNode } from 'react';

export interface DefinitionItem {
  label: string;
  value: ReactNode;
}

/** Label/value pairs; entries without a value are skipped so sparse services stay tidy. */
export function DefinitionList({
  items,
  empty = 'Nothing set.',
}: {
  items: readonly DefinitionItem[];
  empty?: string;
}) {
  const shown = items.filter(
    (item) => item.value !== undefined && item.value !== null && item.value !== '',
  );
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  // A fixed label column at every width keeps pairs apart on phones, where stacked label and value
  // would be as far from each other as from the next pair.
  return (
    <dl className="grid grid-cols-[minmax(6rem,max-content)_1fr] gap-x-6 gap-y-1.5 text-sm">
      {shown.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
