import { CopyButton } from '@oakestra/ui';
import type { AddonEntry } from '../../../core/addons/addon-registry';

/**
 * The keys a deployment preset uses in `nav.items` to rename, move or hide the sidebar items of a
 * loaded addon UI. They are `addon:<name>:<itemId>`, the same key the sidebar builds, so operators
 * can copy them instead of reading the addon's source. Sub-items follow their parent and have no
 * key of their own.
 */
export function navItemKeys(entry: AddonEntry | undefined): string[] {
  if (entry?.state !== 'loaded') return [];
  return (entry.definition.contributions?.['nav.items'] ?? []).map(
    (item) => `addon:${entry.name}:${item.id}`,
  );
}

export function NavItemKeys({ entry }: { entry: AddonEntry | undefined }) {
  const keys = navItemKeys(entry);
  if (keys.length === 0) return null;
  return (
    <ul className="space-y-1" data-testid="nav-item-keys">
      {keys.map((key) => (
        <li key={key} className="flex min-w-0 items-center gap-1">
          <code className="truncate font-mono text-xs">{key}</code>
          <CopyButton value={key} label={`Copy ${key}`} />
        </li>
      ))}
    </ul>
  );
}
