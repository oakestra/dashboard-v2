import type { MarketplaceAddon } from '@oakestra/api';

import { hasDangerousPermissions } from './permissions';

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

/**
 * What the marketplace is narrowed to. Within a list any value matches (an addon has one source
 * and one category, so "all of them" would always be empty), across filters all must match.
 */
export interface MarketplaceFilters {
  sources: readonly string[];
  /** Normalized. */
  categories: readonly string[];
  /** Normalized. */
  tags: readonly string[];
  /** Only addons that ship a dashboard UI (an incompatible one counts: it is part of the addon). */
  withUi: boolean;
  /** Only addons that ask for none of the permissions the consent dialog makes the admin tick. */
  withoutDangerous: boolean;
}

export const NO_FILTERS: MarketplaceFilters = {
  sources: [],
  categories: [],
  tags: [],
  withUi: false,
  withoutDangerous: false,
};

const LIST_PARAMS = { sources: 'source', categories: 'category', tags: 'tag' } as const;

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/**
 * The filters in the URL: repeated `source`, `category` and `tag`, plus `ui=with` and
 * `dangerous=without` (the only directions offered; other values are ignored like a missing
 * parameter).
 */
export function readFilters(params: URLSearchParams): MarketplaceFilters {
  return {
    sources: unique(params.getAll('source')),
    categories: unique(params.getAll('category').map(normalizeCategory)),
    tags: unique(params.getAll('tag').map(normalizeTag)),
    withUi: params.get('ui') === 'with',
    withoutDangerous: params.get('dangerous') === 'without',
  };
}

/** `previous` with the filter parameters replaced by `filters`; other parameters are kept. */
export function writeFilters(
  previous: URLSearchParams,
  filters: MarketplaceFilters,
): URLSearchParams {
  const next = new URLSearchParams(previous);
  for (const [key, param] of Object.entries(LIST_PARAMS) as [keyof typeof LIST_PARAMS, string][]) {
    next.delete(param);
    for (const value of filters[key]) next.append(param, value);
  }
  next.delete('ui');
  if (filters.withUi) next.set('ui', 'with');
  next.delete('dangerous');
  if (filters.withoutDangerous) next.set('dangerous', 'without');
  return next;
}

/** How many separate filters are set: each list counts once, however many values it holds. */
export function activeFilterCount(filters: MarketplaceFilters): number {
  return (
    Number(filters.sources.length > 0) +
    Number(filters.categories.length > 0) +
    Number(filters.tags.length > 0) +
    Number(filters.withUi) +
    Number(filters.withoutDangerous)
  );
}

const hasDashboardUi = (addon: MarketplaceAddon) => addon.ui !== undefined;
const isHarmless = (addon: MarketplaceAddon) => !hasDangerousPermissions(addon.permissions);

/** Code point order, the same for every browser locale, like the marketplace sorts. */
export function byName(a: { name: string }, b: { name: string }): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/** How many addons have each key, in first-seen order. An addon counts once per distinct key. */
function countBy(
  addons: readonly MarketplaceAddon[],
  keysOf: (addon: MarketplaceAddon) => Iterable<string>,
): FacetCount[] {
  const counts = new Map<string, number>();
  for (const addon of addons) {
    for (const key of new Set(keysOf(addon))) {
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts].map(([name, count]) => ({ name, count }));
}

/** The addons matching every filter that is set, in their original order. */
export function filterMarketplace(
  addons: readonly MarketplaceAddon[],
  filters: Partial<MarketplaceFilters>,
): MarketplaceAddon[] {
  const { sources = [], categories = [], tags = [], withUi, withoutDangerous } = filters;
  return addons.filter(
    (addon) =>
      (sources.length === 0 || sources.includes(addon.source.name)) &&
      (categories.length === 0 || categories.includes(normalizeCategory(addon.category ?? ''))) &&
      (tags.length === 0 || addon.tags.some((tag) => tags.includes(normalizeTag(tag)))) &&
      (!withUi || hasDashboardUi(addon)) &&
      (!withoutDangerous || isHarmless(addon)),
  );
}

/** What `GET /categories` answers, computed from a loaded catalog. */
export function countCategories(addons: readonly MarketplaceAddon[]): FacetCount[] {
  return countBy(addons, (addon) => [normalizeCategory(addon.category ?? '')]).sort(byName);
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

export interface FacetCount {
  name: string;
  count: number;
}

export interface FacetCounts {
  sources: FacetCount[];
  categories: FacetCount[];
  tags: FacetCount[];
  /** Addons the two checkboxes would leave, each under the other filters. */
  withUi: number;
  withoutDangerous: number;
}

/**
 * The options of each filter with how many addons choosing it would show: every filter is counted
 * with the others applied but not itself, so checking another value of the same list shows its
 * real reach. Sources keep the catalog's order (official, taps, local); categories and tags are
 * sorted.
 */
export function facetCounts(
  addons: readonly MarketplaceAddon[],
  filters: MarketplaceFilters,
): FacetCounts {
  const without = (changes: Partial<MarketplaceFilters>) =>
    filterMarketplace(addons, { ...filters, ...changes });

  return {
    sources: countBy(without({ sources: [] }), (addon) => [addon.source.name]),
    categories: countCategories(without({ categories: [] })),
    // countBy dedupes, so an addon listing a tag twice in different case still counts once.
    tags: countBy(without({ tags: [] }), (addon) => addon.tags.map(normalizeTag)).sort(byName),
    withUi: without({ withUi: false }).filter(hasDashboardUi).length,
    withoutDangerous: without({ withoutDangerous: false }).filter(isHarmless).length,
  };
}

/**
 * A normalized category as a label: sentence case, with words of up to two letters read as
 * acronyms ("ai tools" becomes "AI tools"), since the marketplace only keeps lowercase.
 */
export function categoryLabel(category: string): string {
  return category
    .split(' ')
    .map((word, index) =>
      word.length <= 2
        ? word.toUpperCase()
        : index === 0
          ? word.charAt(0).toUpperCase() + word.slice(1)
          : word,
    )
    .join(' ');
}
