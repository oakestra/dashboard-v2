import { describe, expect, it, vi } from 'vitest';

import { getDevOverrides, readOverrides, resolveAddons } from './dev-override';
import type { ResolvedAddon } from './ui-addons';

const STORAGE_KEY = 'oakestra.addon-overrides';
const manifest = 'http://localhost:5174/mf-manifest.json';

describe('getDevOverrides', () => {
  it('is ignored in production builds, even with a URL parameter and stored overrides', () => {
    vi.stubEnv('DEV', false);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ example: manifest }));
    window.history.replaceState(null, '', `/?addon-override=example=${manifest}`);

    expect(getDevOverrides()).toEqual({});
  });

  it('is honoured in development builds', () => {
    vi.stubEnv('DEV', true);
    window.history.replaceState(null, '', `/?addon-override=example=${manifest}`);

    expect(getDevOverrides()).toEqual({ example: manifest });
  });
});

describe('readOverrides', () => {
  it('persists overrides from the URL and reads them back later', () => {
    readOverrides(`?addon-override=example=${manifest}`, window.localStorage);
    expect(readOverrides('', window.localStorage)).toEqual({ example: manifest });
  });

  it('clears one override with an empty URL', () => {
    readOverrides(
      `?addon-override=example=${manifest}&addon-override=other=${manifest}`,
      window.localStorage,
    );
    expect(readOverrides('?addon-override=example=', window.localStorage)).toEqual({
      other: manifest,
    });
  });

  it('ignores invalid names, non-http URLs and garbage in storage', () => {
    expect(
      readOverrides(
        '?addon-override=Bad=http://x&addon-override=ok=javascript:alert(1)',
        window.localStorage,
      ),
    ).toEqual({});
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readOverrides('', window.localStorage)).toEqual({});
  });
});

describe('resolveAddons', () => {
  const entryUrl = (name: string) => `/addon-assets/${name}/mf-manifest.json`;
  const pinned: ResolvedAddon = {
    name: 'a',
    version: '2',
    sdk: '^0.1.0',
    entry: 'https://cdn.example/a/mf-manifest.json',
    origin: 'preset',
    basePath: '/apps-a',
  };

  it('uses the nginx path by default', () => {
    expect(resolveAddons([{ name: 'a', version: '1', sdk: '*' }], {}, { entryUrl })).toEqual([
      {
        name: 'a',
        version: '1',
        sdk: '*',
        entry: '/addon-assets/a/mf-manifest.json',
        origin: 'manager',
        basePath: '/addons/a',
      },
    ]);
  });

  it('points overridden addons at the dev server and adds unknown ones', () => {
    const result = resolveAddons(
      [{ name: 'a', version: '1', sdk: '^0.1.0' }],
      { a: manifest, b: manifest },
      { entryUrl },
    );
    expect(result).toEqual([
      {
        name: 'a',
        version: '1',
        sdk: '^0.1.0',
        entry: manifest,
        origin: 'dev',
        basePath: '/addons/a',
      },
      {
        name: 'b',
        version: '0.0.0-dev',
        sdk: '*',
        entry: manifest,
        origin: 'dev',
        basePath: '/addons/b',
      },
    ]);
  });

  it('lets the preset win over a /ui-addons entry of the same name, with one warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const list = [
      { name: 'a', version: '1', sdk: '*' },
      { name: 'c', version: '1', sdk: '*' },
    ];
    expect(resolveAddons(list, {}, { preset: [pinned], entryUrl }).map((a) => a.name)).toEqual([
      'c',
      'a',
    ]);
    expect(resolveAddons(list, {}, { preset: [pinned], entryUrl })).toContainEqual(pinned);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/"a".*preset pins it/);
  });

  it('keeps the mount of a preset addon that a dev override points elsewhere', () => {
    expect(resolveAddons([], { a: manifest }, { preset: [pinned], entryUrl })).toEqual([
      { ...pinned, entry: manifest, origin: 'dev' },
    ]);
  });
});
