import { describe, expect, it, vi } from 'vitest';

import { getDevOverrides, readOverrides, resolveAddons } from './dev-override';

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

  it('uses the nginx path by default', () => {
    expect(resolveAddons([{ name: 'a', version: '1', sdk: '*' }], {}, entryUrl)).toEqual([
      { name: 'a', version: '1', sdk: '*', entry: '/addon-assets/a/mf-manifest.json' },
    ]);
  });

  it('points overridden addons at the dev server and adds unknown ones', () => {
    const result = resolveAddons(
      [{ name: 'a', version: '1', sdk: '^0.1.0' }],
      { a: manifest, b: manifest },
      entryUrl,
    );
    expect(result).toEqual([
      { name: 'a', version: '1', sdk: '^0.1.0', entry: manifest },
      { name: 'b', version: '0.0.0-dev', sdk: '*', entry: manifest },
    ]);
  });
});
