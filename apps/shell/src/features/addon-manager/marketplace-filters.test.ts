import { marketplaceAddonSchema, type MarketplaceAddon } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import {
  categoryLabel,
  countCategories,
  NO_FILTERS,
  activeFilterCount,
  facetCounts,
  filterMarketplace,
  marketplaceSearchValue,
  normalizeCategory,
  readFilters,
  writeFilters,
} from './marketplace-filters';

function addon(
  qualified: string,
  source: string,
  extra: Record<string, unknown> = {},
): MarketplaceAddon {
  return marketplaceAddonSchema.parse({
    name: qualified.split('/').pop(),
    qualified_name: qualified,
    id: qualified.replace('/', '--'),
    source: { kind: source === 'official' ? 'official' : 'tap', name: source },
    version: '1.0.0',
    services: [{ service_name: 'main', image: `registry.example/${qualified}@sha256:1` }],
    ...extra,
  });
}

const catalog = [
  addon('metrics', 'official', { category: 'monitoring', tags: ['metrics', 'prometheus'] }),
  addon('trainer', 'official', { category: 'ai tools', tags: ['ml'] }),
  addon('acme/exporter', 'acme', { category: 'monitoring', tags: ['metrics'] }),
  addon('plain', 'official'),
];
const names = (list: MarketplaceAddon[]) => list.map((item) => item.qualified_name);

describe('filterMarketplace', () => {
  it('matches any value within a filter and every filter together', () => {
    expect(names(filterMarketplace(catalog, {}))).toEqual(names(catalog));
    expect(names(filterMarketplace(catalog, { categories: ['monitoring'] }))).toEqual([
      'metrics',
      'acme/exporter',
    ]);
    expect(names(filterMarketplace(catalog, { categories: ['monitoring', 'ai tools'] }))).toEqual([
      'metrics',
      'trainer',
      'acme/exporter',
    ]);
    expect(
      names(filterMarketplace(catalog, { categories: ['monitoring'], sources: ['acme'] })),
    ).toEqual(['acme/exporter']);
    expect(names(filterMarketplace(catalog, { tags: ['metrics'], sources: ['official'] }))).toEqual(
      ['metrics'],
    );
    expect(filterMarketplace(catalog, { categories: ['monitoring'], tags: ['ml'] })).toEqual([]);
  });
});

describe('readFilters and writeFilters', () => {
  it('reads repeated parameters, normalized like the marketplace, without duplicates', () => {
    const filters = readFilters(
      new URLSearchParams(
        'category=%20AI%20%20Tools&category=ai%20tools&tag=PROMETHEUS&source=acme',
      ),
    );
    expect(filters).toEqual({
      ...NO_FILTERS,
      sources: ['acme'],
      categories: ['ai tools'],
      tags: ['prometheus'],
    });
    expect(names(filterMarketplace(catalog, filters))).toEqual([]);
    expect(normalizeCategory('  Developer\tTools ')).toBe('developer tools');
  });

  it('only reads the offered directions of the two checkboxes', () => {
    expect(readFilters(new URLSearchParams('ui=with&dangerous=without'))).toMatchObject({
      withUi: true,
      withoutDangerous: true,
    });
    expect(readFilters(new URLSearchParams('ui=without&dangerous=with'))).toMatchObject({
      withUi: false,
      withoutDangerous: false,
    });
  });

  it('writes the filters and keeps unrelated parameters', () => {
    const next = writeFilters(new URLSearchParams('q=metrics&category=old'), {
      ...NO_FILTERS,
      categories: ['ai', 'monitoring'],
      withoutDangerous: true,
    });
    expect(next.toString()).toBe('q=metrics&category=ai&category=monitoring&dangerous=without');
    expect(activeFilterCount(readFilters(next))).toBe(2);
  });
});

describe('countCategories', () => {
  it('counts per category, sorted by name, leaving out addons without one', () => {
    expect(countCategories(catalog)).toEqual([
      { name: 'ai tools', count: 1 },
      { name: 'monitoring', count: 2 },
    ]);
    expect(countCategories([])).toEqual([]);
  });
});

describe('marketplaceSearchValue', () => {
  it('covers the display name, category and tags besides the names', () => {
    const value = marketplaceSearchValue(
      addon('acme/exporter', 'acme', {
        display_name: 'Host Exporter',
        category: 'monitoring',
        tags: ['prometheus'],
        metadata: { 'acme.example/id': 'secret-ish' },
      }),
    );
    expect(value).toContain('Host Exporter');
    expect(value).toContain('acme/exporter');
    expect(value).toContain('monitoring');
    expect(value).toContain('prometheus');
    // Metadata is for catalogs and clients, not for people.
    expect(value).not.toContain('secret-ish');
  });
});

describe('facetCounts', () => {
  it('counts every filter with the others applied, but not itself', () => {
    const counts = facetCounts(catalog, { ...NO_FILTERS, sources: ['acme'] });
    // Sources ignore the source filter, so checking another source shows its real reach.
    expect(counts.sources).toEqual(
      expect.arrayContaining([
        { name: 'official', count: 3 },
        { name: 'acme', count: 1 },
      ]),
    );
    // Categories and tags follow the selected source.
    expect(counts.categories).toEqual([{ name: 'monitoring', count: 1 }]);
    expect(counts.tags).toEqual([{ name: 'metrics', count: 1 }]);
  });

  it('counts a tag once per addon and across spellings', () => {
    const counts = facetCounts([addon('x', 'official', { tags: ['ML', 'ml'] })], NO_FILTERS);
    expect(counts.tags).toEqual([{ name: 'ml', count: 1 }]);
  });
});

describe('categoryLabel', () => {
  it('uses sentence case and reads short words as acronyms', () => {
    expect(categoryLabel('developer tools')).toBe('Developer tools');
    expect(categoryLabel('ai')).toBe('AI');
    expect(categoryLabel('ai tools')).toBe('AI tools');
  });
});

describe('dashboard UI and dangerous permissions', () => {
  const withUi = addon('panel', 'official', {
    ui: { service: 'main', sdk: '^0.1.0' },
  });
  const rooted = addon('acme/rooted', 'acme', {
    permissions: { host_network: true },
  });
  const both = [withUi, rooted, addon('plain', 'official')];

  it('keeps only addons with a UI, or only those without dangerous permissions', () => {
    expect(names(filterMarketplace(both, { withUi: true }))).toEqual(['panel']);
    expect(names(filterMarketplace(both, { withoutDangerous: true }))).toEqual(['panel', 'plain']);
  });

  it('counts what each checkbox would leave under the other filters', () => {
    const counts = facetCounts(both, { ...NO_FILTERS, sources: ['acme'] });
    expect(counts.withUi).toBe(0);
    expect(counts.withoutDangerous).toBe(0);
    expect(facetCounts(both, NO_FILTERS)).toMatchObject({ withUi: 1, withoutDangerous: 2 });
  });
});
