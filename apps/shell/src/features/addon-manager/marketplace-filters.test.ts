import { marketplaceAddonSchema, type MarketplaceAddon } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import {
  countCategories,
  filterMarketplace,
  marketplaceSearchValue,
  normalizeCategory,
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
  it('combines source, category and tag with AND', () => {
    expect(names(filterMarketplace(catalog, {}))).toEqual(names(catalog));
    expect(names(filterMarketplace(catalog, { category: 'monitoring' }))).toEqual([
      'metrics',
      'acme/exporter',
    ]);
    expect(names(filterMarketplace(catalog, { category: 'monitoring', source: 'acme' }))).toEqual([
      'acme/exporter',
    ]);
    expect(names(filterMarketplace(catalog, { tag: 'metrics', source: 'official' }))).toEqual([
      'metrics',
    ]);
    expect(filterMarketplace(catalog, { category: 'monitoring', tag: 'ml' })).toEqual([]);
  });

  it('normalizes the wanted category and tag like the marketplace', () => {
    expect(names(filterMarketplace(catalog, { category: '  AI   Tools ' }))).toEqual(['trainer']);
    expect(names(filterMarketplace(catalog, { tag: ' PROMETHEUS ' }))).toEqual(['metrics']);
    expect(normalizeCategory('  Developer\tTools ')).toBe('developer tools');
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
