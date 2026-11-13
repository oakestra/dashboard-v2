import type { MarketplaceAddon, MarketplaceCategory } from '@oakestra/api';

/**
 * The marketplace page loads the whole catalog once and filters it here, so changing a filter
 * sends no request. The rules match the marketplace's own `?category=` and `?tag=`, so a link
 * with `?category=AI` finds `ai`.
 */

/** definition.NormalizeCategory: trimmed, lowercased, inner whitespace collapsed. */
export function normalizeCategory(value: string): string {
  return value.toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

/** definition.NormalizeTag: trimmed and lowercased. */
export function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

export interface MarketplaceFilters {
  /** Source name; empty for all. */
  source?: string;
  category?: string;
  tag?: string;
}

/** The addons matching every filter that is set, in their original order. */
export function filterMarketplace(
  addons: readonly MarketplaceAddon[],
  { source, category, tag }: MarketplaceFilters,
): MarketplaceAddon[] {
  const wantedCategory = normalizeCategory(category ?? '');
  const wantedTag = normalizeTag(tag ?? '');
  return addons.filter(
    (addon) =>
      (!source || addon.source.name === source) &&
      (!wantedCategory || normalizeCategory(addon.category ?? '') === wantedCategory) &&
      (!wantedTag || addon.tags.some((candidate) => normalizeTag(candidate) === wantedTag)),
  );
}

/** What `GET /categories` answers, computed from a loaded catalog. */
export function countCategories(addons: readonly MarketplaceAddon[]): MarketplaceCategory[] {
  const counts = new Map<string, number>();
  for (const addon of addons) {
    const name = normalizeCategory(addon.category ?? '');
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, count]) => ({ name, count }));
}

/** Text the search box matches: names, description, category, tags, source and images. */
export function marketplaceSearchValue(addon: MarketplaceAddon): string {
  return [
    addon.display_name,
    addon.qualified_name,
    addon.description,
    addon.category,
    ...addon.tags,
    addon.source.name,
    ...addon.services.map((service) => service.image),
  ]
    .filter(Boolean)
    .join(' ');
}
