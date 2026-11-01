import type { CurrentUser, NavItem } from '@oakestra/dashboard-sdk';
import { describe, expect, it } from 'vitest';

import type { ResolvedContribution } from '../../core/extensions/registry';
import { buildNavEntries, findActiveKey } from './nav-model';

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
