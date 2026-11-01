import type { ReactNode } from 'react';

export interface DefinitionItem {
  label: string;
  value: ReactNode;
}

/** Label/value pairs; entries without a value are skipped so sparse services stay tidy. */
export function DefinitionList({ items }: { items: readonly DefinitionItem[] }) {
  const shown = items.filter(
    (item) => item.value !== undefined && item.value !== null && item.value !== '',
  );
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">Nothing set.</p>;
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
      {shown.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
