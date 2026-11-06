import { SDK_VERSION, type AddonDefinition } from '@oakestra/dashboard-sdk';
import { describe, expect, it, vi } from 'vitest';

import { createContributionRegistry, selectContributions } from '../extensions/registry';
import { createAddonRegistry } from './addon-registry';
import { createAddonLoader } from './loader';
import { registerLinkedAddons, type LinkedAddon } from './linked-addons';
import type { ResolvedAddon } from './ui-addons';

const Page = () => null;

const help: LinkedAddon = {
  mount: '/help',
  definition: {
    id: 'help',
    label: 'Help',
    routes: [{ index: true, Component: Page }],
    contributions: { 'nav.items': [{ id: 'help', label: 'Help', path: '', group: 'footer' }] },
  },
};

function setup(linked: readonly LinkedAddon[]) {
  const addons = createAddonRegistry();
  const contributions = createContributionRegistry();
  registerLinkedAddons(linked, { addons, contributions });
  const navPaths = () =>
    selectContributions(contributions.getState().sources, 'nav.items', null).map(
      ({ item }) => item.path,
    );
  return { addons, contributions, navPaths };
}

describe('registerLinkedAddons', () => {
  it('registers linked addons as not remote and without a version of their own', () => {
    const { contributions } = setup([help]);
    const { source } = contributions.getState().sources['addon:help']!;
    expect(source).toMatchObject({ remote: false, displayName: 'Help' });
    expect(source).not.toHaveProperty('version', SDK_VERSION);
  });

  it('registers the definition as loaded at its mount, without a loading state', () => {
    const { addons, navPaths } = setup([help]);
    expect(addons.getState().entries.help).toMatchObject({
      state: 'loaded',
      origin: 'linked',
      basePath: '/help',
      version: SDK_VERSION,
      definition: { id: 'help', label: 'Help' },
    });
    expect(navPaths()).toEqual(['/help']);
  });

  it('turns an invalid definition into a failed entry instead of throwing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { id: 'help', routes: [{ path: '/absolute' }] } as AddonDefinition;
    const { addons, navPaths } = setup([{ definition: broken, mount: '/help' }]);
    expect(addons.getState().entries.help).toMatchObject({
      state: 'failed',
      error: expect.stringMatching(/relative to the addon base path/),
    });
    expect(navPaths()).toEqual([]);
  });

  it('is left alone by the loader: never loaded from a list, never removed as missing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { addons, contributions, navPaths } = setup([help]);
    const runtime = { register: vi.fn(), load: vi.fn() };
    const loader = createAddonLoader({
      sdkVersion: SDK_VERSION,
      runtime,
      addons,
      contributions,
      onUpgradeAvailable: vi.fn(),
    });
    const manager: ResolvedAddon = {
      name: 'help',
      version: '9.0.0',
      sdk: '*',
      entry: 'http://shell/addon-assets/help/mf-manifest.json',
      origin: 'manager',
      basePath: '/addons/help',
    };

    await loader.sync([manager]);
    await loader.sync([]);

    expect(runtime.load).not.toHaveBeenCalled();
    expect(addons.getState().entries.help).toMatchObject({ origin: 'linked', state: 'loaded' });
    expect(addons.getState().removed).toEqual({});
    expect(navPaths()).toEqual(['/help']);
  });
});
