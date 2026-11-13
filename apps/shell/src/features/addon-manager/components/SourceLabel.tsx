import type { AddonSourceKind, AddonSourceRef } from '@oakestra/api';
import { SourceTag } from '@oakestra/ui';

export const SOURCE_KIND_LABELS: Readonly<Record<AddonSourceKind, string>> = {
  official: 'Official',
  tap: 'Tap',
  local: 'Local',
};

/** The official and local sources are named after their kind, so only taps need the label. */
export function showsSourceKind(source: AddonSourceRef): boolean {
  return source.name.toLowerCase() !== source.kind;
}

/** A source by name, with its kind where the name does not already say it. */
export function SourceLabel({ source }: { source: AddonSourceRef }) {
  return (
    <span className="inline-flex items-center gap-2">
      <SourceTag name={source.name} />
      {showsSourceKind(source) ? (
        <span className="text-muted-foreground">{SOURCE_KIND_LABELS[source.kind]}</span>
      ) : null}
    </span>
  );
}
