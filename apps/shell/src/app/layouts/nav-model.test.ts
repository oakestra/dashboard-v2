import type { CurrentUser, NavItem } from '@oakestra/dashboard-sdk';
import { describe, expect, it } from 'vitest';

import type { ResolvedContribution } from '../../core/extensions/registry';
import { applyNavOverrides, buildNavEntries, findActiveKey } from './nav-model';

const source = { kind: 'core', id: 'demo', label: 'Demo' } as const;
const resolve = (...items: NavItem[]): ResolvedContribution<'nav.items'>[] =>
  items.map((item) => ({ item, source }));

const alice: CurrentUser = {
  username: 'alice',
  roles: ['Application_Provider'],
  organization: null,
};

describe('buildNavEntries', () => {
  it('drops sub-items the user may not see and sorts the rest', () => {
    const [entry] = buildNavEntries(
      resolve({
        id: 'x',
        label: 'X',
        path: '/x',
        children: [
          { id: 'c', label: 'C', path: '/x/c' },
          { id: 'admin', label: 'Admin', path: '/x/admin', roles: ['Admin'] },
          { id: 'b', label: 'B', path: '/x/b', order: 2 },
          { id: 'a', label: 'A', path: '/x/a', order: 1 },
          { id: 'd', label: 'D', path: '/x/d' },
        ],
      }),
      alice,
    );
    expect(entry?.children.map((child) => child.item.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(entry?.children[0]?.key).toBe('core:demo:x/a');
  });

  it('gives items without children an empty list', () => {
    const [entry] = buildNavEntries(resolve({ id: 'x', label: 'X', path: '/x' }), null);
    expect(entry?.children).toEqual([]);
  });
});

describe('findActiveKey', () => {
  const entries = buildNavEntries(
    resolve(
      { id: 'home', label: 'Home', path: '/' },
      { id: 'flat', label: 'Flat', path: '/addons/x' },
      { id: 'flat-jobs', label: 'Jobs', path: '/addons/x/jobs' },
      {
        id: 'nested',
        label: 'Nested',
        path: '/addons/y',
        children: [
          { id: 'overview', label: 'Overview', path: '/addons/y' },
          { id: 'logs', label: 'Logs', path: '/addons/y/logs' },
        ],
      },
    ),
    null,
  );

  it('picks the longest matching path', () => {
    expect(findActiveKey(entries, '/addons/x/jobs/42')).toBe('core:demo:flat-jobs');
    expect(findActiveKey(entries, '/addons/x/other')).toBe('core:demo:flat');
    expect(findActiveKey(entries, '/addons/y/logs')).toBe('core:demo:nested/logs');
  });

  it('prefers a sub-item over its parent on the same path', () => {
    expect(findActiveKey(entries, '/addons/y')).toBe('core:demo:nested/overview');
    expect(findActiveKey(entries, '/addons/y/details/1')).toBe('core:demo:nested/overview');
  });

  it('matches "/" only exactly and does not match path prefixes of other segments', () => {
    expect(findActiveKey(entries, '/')).toBe('core:demo:home');
    expect(findActiveKey(entries, '/addons/xy')).toBeUndefined();
  });
});

describe('applyNavOverrides', () => {
  const entries = buildNavEntries(
    resolve(
      { id: 'a', label: 'A', path: '/a', order: 1 },
      {
        id: 'b',
        label: 'B',
        path: '/b',
        order: 2,
        children: [{ id: 'c', label: 'C', path: '/b/c' }],
      },
      { id: 'c', label: 'C', path: '/c' },
      { id: 'd', label: 'D', path: '/d' },
    ),
    null,
  );
  const labels = (list: ReturnType<typeof applyNavOverrides>) => list.map((e) => e.item.label);

  it('returns the entries untouched without overrides', () => {
    expect(applyNavOverrides(entries, {})).toEqual(entries);
  });

  it('replaces label, order and group, and keeps the key and the sub-items', () => {
    const result = applyNavOverrides(entries, {
      'core:demo:b': { label: 'Bee', order: 0, group: 'management' },
    });
    expect(labels(result)).toEqual(['Bee', 'A', 'C', 'D']);
    expect(result[0]).toMatchObject({ key: 'core:demo:b', item: { group: 'management' } });
    expect(result[0]?.children.map((child) => child.key)).toEqual(['core:demo:b/c']);
  });

  it('drops hidden entries', () => {
    expect(labels(applyNavOverrides(entries, { 'core:demo:a': { hidden: true } }))).toEqual([
      'B',
      'C',
      'D',
    ]);
  });

  it('keeps the current position among items with the same order', () => {
    // C and D are unordered and stay in registration order; giving D the same order as A puts it
    // right behind A rather than in front.
    const result = applyNavOverrides(entries, { 'core:demo:d': { order: 1 } });
    expect(labels(result)).toEqual(['A', 'D', 'B', 'C']);
  });

  it('ignores keys that match nothing', () => {
    expect(labels(applyNavOverrides(entries, { 'core:demo:nope': { hidden: true } }))).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
  });
});
