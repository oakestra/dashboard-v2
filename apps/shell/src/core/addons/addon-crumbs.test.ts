import type { AddonRoute } from '@oakestra/dashboard-sdk';
import { describe, expect, it } from 'vitest';

import { addonCrumbs } from './addon-crumbs';
import type { AddonEntry } from './addon-registry';

const Page = () => null;
const base = { name: 'flops', version: '1.0.0', sdk: '^0.1.0', entry: 'http://x/mf-manifest.json' };

const routes: AddonRoute[] = [
  { index: true, Component: Page },
  { path: 'jobs', crumb: 'Jobs', Component: Page, children: [{ path: ':jobId', crumb: 'Job' }] },
  { path: 'about', Component: Page },
];

function loaded(label?: string): AddonEntry {
  return { ...base, state: 'loaded', definition: { id: 'flops', label, routes } };
}

const trail = (pathname: string, entry: AddonEntry | undefined) =>
  addonCrumbs('flops', pathname, entry).map(({ label, to }) => [label, to]);

describe('addonCrumbs', () => {
  it('starts with the addon label and adds the matched routes that declare a crumb', () => {
    expect(trail('/addons/flops', loaded('FLOps'))).toEqual([['FLOps', '/addons/flops']]);
    expect(trail('/addons/flops/jobs/7', loaded('FLOps'))).toEqual([
      ['FLOps', '/addons/flops'],
      ['Jobs', '/addons/flops/jobs'],
      ['Job', '/addons/flops/jobs/7'],
    ]);
    // A route without a crumb adds nothing.
    expect(trail('/addons/flops/about', loaded('FLOps'))).toEqual([['FLOps', '/addons/flops']]);
  });

  it('matches the base path case-insensitively, like the router', () => {
    expect(trail('/Addons/flops/Jobs', loaded('FLOps'))).toEqual([
      ['FLOps', '/addons/flops'],
      ['Jobs', '/addons/flops/Jobs'],
    ]);
  });

  it('falls back to the id without a label, while loading, after a failure and when unknown', () => {
    expect(trail('/addons/flops/jobs', loaded())).toEqual([
      ['flops', '/addons/flops'],
      ['Jobs', '/addons/flops/jobs'],
    ]);
    expect(trail('/addons/flops/jobs', { ...base, state: 'loading' })).toEqual([
      ['flops', '/addons/flops'],
    ]);
    expect(trail('/addons/flops/jobs', { ...base, state: 'failed', error: 'x' })).toEqual([
      ['flops', '/addons/flops'],
    ]);
    expect(trail('/addons/flops/jobs', undefined)).toEqual([['flops', '/addons/flops']]);
  });

  it('adds the crumb of an index route on the base path', () => {
    const entry: AddonEntry = {
      ...base,
      state: 'loaded',
      definition: { id: 'flops', routes: [{ index: true, crumb: 'Overview', Component: Page }] },
    };
    for (const pathname of ['/addons/flops', '/addons/flops/']) {
      expect(trail(pathname, entry)).toEqual([
        ['flops', '/addons/flops'],
        ['Overview', '/addons/flops'],
      ]);
    }
  });

  it('adds no route crumbs for a path the addon does not have', () => {
    expect(trail('/addons/flops/nope', loaded('FLOps'))).toEqual([['FLOps', '/addons/flops']]);
  });

  it('gives every crumb a distinct id', () => {
    const ids = addonCrumbs('flops', '/addons/flops/jobs/7', loaded()).map((crumb) => crumb.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
