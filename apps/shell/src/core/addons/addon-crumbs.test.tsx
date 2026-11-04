import {
  useAddonPath,
  type AddonCrumbProps,
  type AddonRoute,
  type CurrentUser,
} from '@oakestra/dashboard-sdk';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { addonCrumbs, navOverrideLabel } from './addon-crumbs';
import type { AddonEntry } from './addon-registry';

const Page = () => null;
const base = {
  name: 'flops',
  version: '1.0.0',
  sdk: '^0.1.0',
  entry: 'http://x/mf-manifest.json',
  origin: 'manager' as const,
  basePath: '/addons/flops',
};

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

  it('renders component crumbs with the route params and the addon context', () => {
    function JobCrumb({ params }: AddonCrumbProps) {
      return <>{`Job ${params.jobId} at ${useAddonPath()('jobs', params.jobId ?? '')}`}</>;
    }
    const entry: AddonEntry = {
      ...base,
      state: 'loaded',
      definition: {
        id: 'flops',
        routes: [{ path: 'jobs/:jobId', crumb: JobCrumb, Component: Page }],
      },
    };
    const crumbs = addonCrumbs('flops', '/addons/flops/jobs/7', entry);
    expect(crumbs.map(({ to }) => to)).toEqual(['/addons/flops', '/addons/flops/jobs/7']);
    render(<>{crumbs[1]!.label}</>);
    expect(screen.getByText('Job 7 at /addons/flops/jobs/7')).toBeVisible();
  });

  it('falls back to the last path segment when a component crumb throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Broken = (): never => {
      throw new Error('no name');
    };
    const entry: AddonEntry = {
      ...base,
      state: 'loaded',
      definition: {
        id: 'flops',
        routes: [{ path: 'jobs/:jobId', crumb: Broken, Component: Page }],
      },
    };
    render(<>{addonCrumbs('flops', '/addons/flops/jobs/a%20b', entry)[1]!.label}</>);
    expect(screen.getByText('a b')).toBeVisible();
  });

  it('stops the trail at the first route the user may not open, without rendering its crumb', () => {
    const Admin = vi.fn(() => <>admin crumb</>);
    const Deeper = vi.fn(() => <>deeper crumb</>);
    const entry: AddonEntry = {
      ...base,
      state: 'loaded',
      definition: {
        id: 'flops',
        routes: [
          {
            path: 'orgs',
            crumb: 'Orgs',
            Component: Page,
            children: [
              {
                path: ':orgId',
                crumb: Admin,
                roles: ['Admin'],
                children: [{ path: 'x', crumb: Deeper }],
              },
            ],
          },
        ],
      },
    };
    const user = (roles: string[]) => ({ roles }) as unknown as CurrentUser;
    const denied = addonCrumbs(
      'flops',
      '/addons/flops/orgs/1/x',
      entry,
      '/addons/flops',
      user(['Application_Provider']),
    );
    expect(denied.map(({ to }) => to)).toEqual(['/addons/flops', '/addons/flops/orgs']);
    expect(addonCrumbs('flops', '/addons/flops/orgs/1/x', entry)).toHaveLength(2);
    const allowed = addonCrumbs(
      'flops',
      '/addons/flops/orgs/1/x',
      entry,
      '/addons/flops',
      user(['Admin']),
    );
    expect(allowed).toHaveLength(4);
    expect(Admin).not.toHaveBeenCalled();

    // A denied route with a plain label keeps it, and still ends the trail.
    const labelled: AddonEntry = {
      ...base,
      state: 'loaded',
      definition: {
        id: 'flops',
        routes: [
          {
            path: 'settings',
            crumb: 'Settings',
            roles: ['Admin'],
            children: [{ path: 'deep', crumb: Deeper }],
          },
        ],
      },
    };
    expect(
      addonCrumbs('flops', '/addons/flops/settings/deep', labelled, '/addons/flops', user([])).map(
        ({ label }) => label,
      ),
    ).toEqual(['flops', 'Settings']);
  });
});

describe('navOverrideLabel', () => {
  const withNav = (path: string): AddonEntry => ({
    ...base,
    state: 'loaded',
    definition: {
      id: 'flops',
      label: 'FLOps',
      routes,
      contributions: { 'nav.items': [{ id: 'main', label: 'FLOps', path }] },
    },
  });

  it('takes the preset label of the nav item that links to the addon itself', () => {
    const overrides = { 'addon:flops:main': { label: 'Lab' } };
    expect(navOverrideLabel('flops', withNav(''), overrides)).toBe('Lab');
    expect(navOverrideLabel('flops', withNav('./'), overrides)).toBe('Lab');
    expect(
      addonCrumbs('flops', '/addons/flops', withNav(''), '/addons/flops', null, 'Lab')[0]!.label,
    ).toBe('Lab');
  });

  it('ignores items for sub-pages, overrides without a label and addons not loaded', () => {
    expect(
      navOverrideLabel('flops', withNav('jobs'), { 'addon:flops:main': { label: 'Lab' } }),
    ).toBeUndefined();
    expect(
      navOverrideLabel('flops', withNav(''), { 'addon:flops:main': { order: 1 } }),
    ).toBeUndefined();
    expect(
      navOverrideLabel(
        'flops',
        { ...base, state: 'loading' },
        { 'addon:flops:main': { label: 'Lab' } },
      ),
    ).toBeUndefined();
  });
});
