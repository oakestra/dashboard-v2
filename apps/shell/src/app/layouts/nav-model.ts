import {
  hasAnyRole,
  type CurrentUser,
  type NavItem,
  type NavSubItem,
} from '@oakestra/dashboard-sdk';

import type { ContributionSource, ResolvedContribution } from '../../core/extensions/registry';

export interface NavSubEntry {
  key: string;
  item: NavSubItem;
}

export interface NavEntry {
  key: string;
  item: NavItem;
  source: ContributionSource;
  /** Sub-items the user may see, sorted. Empty when the item has none or all are hidden. */
  children: NavSubEntry[];
}

const UNORDERED = Number.MAX_SAFE_INTEGER;

/**
 * Attaches the visible, sorted sub-items to each nav item. Top-level items were already filtered
 * and sorted by the registry; sub-items follow the same rules (`roles`, then `order`, then
 * declaration order).
 */
export function buildNavEntries(
  items: readonly ResolvedContribution<'nav.items'>[],
  user: CurrentUser | null,
): NavEntry[] {
  return items.map(({ item, source }) => {
    const key = `${source.kind}:${source.id}:${item.id}`;
    const children = (item.children ?? [])
      .map((child, index) => ({ child, index }))
      .filter(({ child }) => hasAnyRole(user, child.roles))
      .sort(
        (a, b) => (a.child.order ?? UNORDERED) - (b.child.order ?? UNORDERED) || a.index - b.index,
      )
      .map(({ child }) => ({ key: `${key}/${child.id}`, item: child }));
    return { key, item, source, children };
  });
}

/**
 * The key of the one entry that should be highlighted for `pathname`: the one with the longest
 * matching path. Prefix matching alone would also light up `/addons/x` on `/addons/x/jobs`, so a
 * parent and its sub-item (or two flat items of one addon) would both look selected. On a tie, a
 * sub-item wins over its parent, which covers an "Overview" sub-item pointing at the parent's path.
 */
export function findActiveKey(entries: readonly NavEntry[], pathname: string): string | undefined {
  let best: { key: string; length: number; depth: number } | undefined;
  const consider = (key: string, path: string, depth: number) => {
    if (!matchesPath(path, pathname)) return;
    if (!best || path.length > best.length || (path.length === best.length && depth > best.depth)) {
      best = { key, length: path.length, depth };
    }
  };
  for (const entry of entries) {
    consider(entry.key, entry.item.path, 0);
    for (const child of entry.children) consider(child.key, child.item.path, 1);
  }
  return best?.key;
}

function matchesPath(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}
