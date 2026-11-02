import type { AddonDefinition } from '@oakestra/dashboard-sdk';
import { describe, expect, it, vi } from 'vitest';

import { createContributionRegistry, selectContributions } from '../extensions/registry';
import { createAddonRegistry } from './addon-registry';
import type { AddonModuleRuntime } from './federation-runtime';
import { createAddonLoader } from './loader';
import type { ResolvedAddon } from './ui-addons';

const Widget = () => null;

const definition = (id: string): AddonDefinition => ({
  id,
  routes: [{ index: true, Component: Widget }],
  contributions: {
    'nav.items': [
      { id: 'nav', label: id, path: '' },
      {
        id: 'jobs',
        label: 'Jobs',
        path: 'jobs',
        children: [
          { id: 'all', label: 'All', path: 'jobs' },
          { id: 'failed', label: 'Failed', path: './jobs/failed' },
        ],
      },
    ],
    'home.widgets': [{ id: 'w', title: 'W', component: Widget }],
  },
});

const addon = (name: string, version = '1.0.0', sdk = '^0.1.0'): ResolvedAddon => ({
  name,
  version,
  sdk,
  entry: `http://shell/addon-assets/${name}/mf-manifest.json`,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(
  load: (name: string) => Promise<unknown> = (name) =>
    Promise.resolve({ default: definition(name) }),
) {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const runtime = { register: vi.fn(), load: vi.fn(load) } satisfies AddonModuleRuntime;
  const addons = createAddonRegistry();
  const contributions = createContributionRegistry();
  const onUpgradeAvailable = vi.fn();
  const loader = createAddonLoader({
    sdkVersion: '0.1.0',
    runtime,
    addons,
    contributions,
    onUpgradeAvailable,
  });
  const entry = (name: string) => addons.getState().entries[name];
  const navPaths = () =>
    selectContributions(contributions.getState().sources, 'nav.items', null).map(
      ({ item }) => item.path,
    );
  return { runtime, addons, contributions, loader, onUpgradeAvailable, entry, navPaths };
}

describe('addon loader', () => {
  it('registers, loads and registers contributions of a new addon', async () => {
    const { runtime, loader, entry, navPaths, contributions } = setup();
    await loader.sync([addon('flops')]);

    expect(runtime.register).toHaveBeenCalledWith('flops', addon('flops').entry);
    expect(runtime.load).toHaveBeenCalledWith('flops');
    expect(entry('flops')).toMatchObject({ state: 'loaded', version: '1.0.0' });
    expect(navPaths()).toEqual(['/addons/flops', '/addons/flops/jobs']);
    const [nav, jobs] = selectContributions(contributions.getState().sources, 'nav.items', null);
    expect(nav?.item.group).toBe('addons');
    expect(jobs?.item.children?.map((child) => child.path)).toEqual([
      '/addons/flops/jobs',
      '/addons/flops/jobs/failed',
    ]);
    expect(nav?.source).toMatchObject({ kind: 'addon', addon: { basePath: '/addons/flops' } });
  });

  it('marks the addon as loading while the remote is fetched', async () => {
    const pending = deferred<unknown>();
    const { loader, entry } = setup(() => pending.promise);
    const done = loader.sync([addon('flops')]);
    expect(entry('flops')?.state).toBe('loading');
    pending.resolve({ default: definition('flops') });
    await done;
    expect(entry('flops')?.state).toBe('loaded');
  });

  it('does not load the same addon twice', async () => {
    const { runtime, loader } = setup();
    await loader.sync([addon('flops')]);
    await loader.sync([addon('flops')]);
    expect(runtime.load).toHaveBeenCalledTimes(1);
  });

  it('marks an addon with an unsatisfied SDK range as incompatible without loading it', async () => {
    const { runtime, loader, entry } = setup();
    await loader.sync([addon('flops', '1.0.0', '^1.0.0')]);
    expect(runtime.register).not.toHaveBeenCalled();
    expect(entry('flops')).toMatchObject({ state: 'incompatible' });
    expect(entry('flops')?.state === 'incompatible' && entry('flops')).toMatchObject({
      error: expect.stringContaining('^1.0.0'),
    });
  });

  it('re-checks an incompatible addon once it publishes a new version', async () => {
    const { runtime, loader, entry } = setup();
    await loader.sync([addon('flops', '1.0.0', '^1.0.0')]);
    await loader.sync([addon('flops', '1.0.1', '^0.1.0')]);
    expect(runtime.load).toHaveBeenCalledTimes(1);
    expect(entry('flops')?.state).toBe('loaded');
  });

  it('marks a failed load and retries it on the next sync', async () => {
    let attempts = 0;
    const { runtime, loader, entry } = setup((name) => {
      attempts += 1;
      if (attempts === 1) return Promise.reject(new Error('502 Bad Gateway'));
      return Promise.resolve({ default: definition(name) });
    });

    await loader.sync([addon('flops')]);
    expect(entry('flops')).toMatchObject({ state: 'failed', error: '502 Bad Gateway' });

    await loader.sync([addon('flops')]);
    expect(runtime.register).toHaveBeenCalledTimes(2);
    expect(entry('flops')?.state).toBe('loaded');
  });

  it('leaves the registry untouched when a retry fails the same way', async () => {
    let attempts = 0;
    const { addons, loader, entry } = setup(() => {
      attempts += 1;
      return Promise.reject(new Error(attempts < 3 ? '502 Bad Gateway' : '504 Gateway Timeout'));
    });

    await loader.sync([addon('flops')]);
    const entries = addons.getState().entries;
    await loader.sync([addon('flops')]);
    expect(addons.getState().entries).toBe(entries);

    await loader.sync([addon('flops')]);
    expect(entry('flops')).toMatchObject({ state: 'failed', error: '504 Gateway Timeout' });
  });

  it('keeps showing the previous failure while a retry is in flight', async () => {
    const retry = deferred<unknown>();
    let attempts = 0;
    const { runtime, loader, entry } = setup(() => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new Error('502 Bad Gateway')) : retry.promise;
    });

    await loader.sync([addon('flops')]);
    const retrying = loader.sync([addon('flops')]);
    expect(entry('flops')).toMatchObject({ state: 'failed', error: '502 Bad Gateway' });

    // A poll that arrives while the retry is still running must not start a second load.
    await loader.sync([addon('flops')]);
    expect(runtime.load).toHaveBeenCalledTimes(2);

    retry.resolve({ default: definition('flops') });
    await retrying;
    expect(entry('flops')?.state).toBe('loaded');
  });

  it('fails addons whose definition does not validate', async () => {
    const { loader, entry, navPaths } = setup(() =>
      Promise.resolve({ default: { id: 'someone-else' } }),
    );
    await loader.sync([addon('flops')]);
    expect(entry('flops')).toMatchObject({
      state: 'failed',
      error: expect.stringContaining('does not match'),
    });
    expect(navPaths()).toEqual([]);
  });

  it('removes addons that are no longer listed, together with their contributions', async () => {
    const { loader, addons, entry, navPaths } = setup();
    await loader.sync([addon('flops'), addon('other')]);
    await loader.sync([addon('other')]);

    expect(entry('flops')).toBeUndefined();
    expect(addons.getState().removed).toEqual({ flops: true });
    expect(navPaths()).toEqual(['/addons/other', '/addons/other/jobs']);
  });

  it('forgets the removal once the addon comes back', async () => {
    const { loader, addons, entry } = setup();
    await loader.sync([addon('flops')]);
    await loader.sync([]);
    await loader.sync([addon('flops')]);
    expect(entry('flops')?.state).toBe('loaded');
    expect(addons.getState().removed).toEqual({});
  });

  it('ignores a load that finishes after the addon was removed', async () => {
    const pending = deferred<unknown>();
    const { loader, entry, navPaths } = setup(() => pending.promise);
    const first = loader.sync([addon('flops')]);
    await loader.sync([]);
    pending.resolve({ default: definition('flops') });
    await first;

    expect(entry('flops')).toBeUndefined();
    expect(navPaths()).toEqual([]);
  });

  it('asks for a reload once per new version instead of swapping a loaded addon', async () => {
    const { runtime, loader, entry, onUpgradeAvailable } = setup();
    await loader.sync([addon('flops', '1.0.0')]);
    await loader.sync([addon('flops', '1.1.0')]);
    await loader.sync([addon('flops', '1.1.0')]);

    expect(runtime.load).toHaveBeenCalledTimes(1);
    expect(onUpgradeAvailable).toHaveBeenCalledTimes(1);
    expect(onUpgradeAvailable).toHaveBeenCalledWith(
      expect.objectContaining({ version: '1.0.0' }),
      expect.objectContaining({ version: '1.1.0' }),
    );
    expect(entry('flops')).toMatchObject({
      state: 'loaded',
      version: '1.0.0',
      availableVersion: '1.1.0',
    });

    await loader.sync([addon('flops', '1.2.0')]);
    expect(onUpgradeAvailable).toHaveBeenCalledTimes(2);
  });
});
