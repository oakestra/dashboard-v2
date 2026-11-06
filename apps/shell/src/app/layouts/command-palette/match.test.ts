import { describe, expect, it } from 'vitest';

import { filterAndRank, matchRank } from './match';

const labels = (items: readonly { label: string }[]) => items.map((item) => item.label);

describe('matchRank', () => {
  it('finds nothing without a match in any field', () => {
    expect(matchRank('fleet', { label: 'Applications' })).toBeUndefined();
  });

  it('needs every word, in any order and any field', () => {
    const item = { label: 'New application', keywords: ['create'] };
    expect(matchRank('app new', item)).toBeDefined();
    expect(matchRank('create app', item)).toBeDefined();
    expect(matchRank('app delete', item)).toBeUndefined();
  });

  it('ignores case and extra spaces', () => {
    expect(matchRank('  NEW   app ', { label: 'New application' })).toBeDefined();
  });

  it('does not count a position before the first word as a word start', () => {
    expect(matchRank('ring', { label: 'Monitoring' })).toBeGreaterThan(
      matchRank('ring', { label: 'Ring buffer' }) ?? Infinity,
    );
  });
});

describe('filterAndRank', () => {
  it('ranks prefix and word matches above matches inside a word', () => {
    const items = [{ label: 'Monitoring' }, { label: 'Open ring' }, { label: 'Ring' }];
    expect(labels(filterAndRank(items, 'ring'))).toEqual(['Ring', 'Open ring', 'Monitoring']);
  });

  it('ranks the label above keywords above the description', () => {
    const items = [
      { label: 'A', description: 'cluster overview' },
      { label: 'B', keywords: ['cluster'] },
      { label: 'Cluster' },
    ];
    expect(labels(filterAndRank(items, 'cluster'))).toEqual(['Cluster', 'B', 'A']);
  });

  it('ranks a keyword start above the inside of a label', () => {
    const items = [{ label: 'Colorado' }, { label: 'X', keywords: ['radio'] }];
    expect(labels(filterAndRank(items, 'rad'))).toEqual(['X', 'Colorado']);
  });

  it('keeps the order of equal matches and of everything on an empty query', () => {
    const items = [{ label: 'Beta' }, { label: 'Alpha' }];
    expect(labels(filterAndRank(items, ''))).toEqual(['Beta', 'Alpha']);
    expect(labels(filterAndRank(items, 'a'))).toEqual(['Alpha', 'Beta']);
    expect(labels(filterAndRank(items, 'ta'))).toEqual(['Beta']);
  });
});
