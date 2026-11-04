import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ConfigError } from './config';
import { DEFAULT_PRESET, loadPreset, parsePreset, presetSchema } from './preset';

const addon = { name: 'acme-billing', version: '1.0.0', sdk: '^0.1.0', entry: '/b/mf.json' };

function mockFetch(response: Response | Error) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
}

describe('presetSchema', () => {
  it('defaults to every module, discovery on, no addons and no nav overrides', () => {
    expect(DEFAULT_PRESET).toEqual({
      addonDiscovery: true,
      addons: [],
      nav: { groupLabels: {}, items: {} },
    });
  });

  it('accepts the documented format', () => {
    const preset = parsePreset({
      $schema: './preset.schema.json',
      modules: ['overview', 'applications'],
      home: '/applications',
      addonDiscovery: false,
      addons: [
        { ...addon, entry: 'https://cdn.example/b/mf-manifest.json', mount: '/billing' },
        { ...addon, name: 'acme-infra' },
      ],
      nav: {
        groupLabels: { main: 'Workloads' },
        items: { 'core:help:help': { hidden: true }, 'addon:acme-billing:x': { order: 1 } },
      },
    });
    expect(preset.addons[0]!.mount).toBe('/billing');
    expect(preset.nav.items['core:help:help']).toEqual({ hidden: true });
  });

  it.each([
    ['an unknown top-level key', { modulez: [] }],
    ['an unknown addon key', { addons: [{ ...addon, mountt: '/x' }] }],
    ['an unknown nav override key', { nav: { items: { 'core:a:b': { lable: 'x' } } } }],
    ['an unknown nav group', { nav: { groupLabels: { side: 'x' } } }],
    ['a module listed twice', { modules: ['help', 'help'] }],
    ['a protocol-relative home', { home: '//evil.example' }],
    ['a backslash home that leaves the origin', { home: '/\\evil.example/x' }],
    ['the root as home', { home: '/' }],
    ['the root with a query as home', { home: '/?x=1' }],
    [
      'a backslash entry that leaves the origin',
      { addons: [{ ...addon, entry: '/\\evil.com/x' }] },
    ],
    ['an addon name with capitals', { addons: [{ ...addon, name: 'Acme' }] }],
    ['an invalid sdk range', { addons: [{ ...addon, sdk: 'latest!' }] }],
    ['an entry that is neither a path nor http(s)', { addons: [{ ...addon, entry: 'ftp://x' }] }],
    ['a protocol-relative entry', { addons: [{ ...addon, entry: '//cdn.example/x.json' }] }],
    ['a mount with a param', { addons: [{ ...addon, mount: '/x/:id' }] }],
    ['a mount with a trailing slash', { addons: [{ ...addon, mount: '/x/' }] }],
    ['the root as mount', { addons: [{ ...addon, mount: '/' }] }],
  ])('rejects %s', (_name, raw) => {
    expect(() => parsePreset(raw)).toThrow(ConfigError);
  });

  it('explains why the root cannot be the home page', () => {
    expect(() => parsePreset({ home: '/' })).toThrow(/redirect to itself/);
  });

  it('accepts a home with a query or a deeper path', () => {
    expect(parsePreset({ home: '/applications?x=1' }).home).toBe('/applications?x=1');
  });

  it('rejects duplicate addon names', () => {
    expect(() => parsePreset({ addons: [addon, addon] })).toThrow(/listed twice/);
  });

  // Editors complete and check preset.json files against this file. Update it with
  // `pnpm --filter @oakestra/shell test -u`.
  it('matches the committed JSON Schema', async () => {
    const schema = z.toJSONSchema(presetSchema, { io: 'input' });
    await expect(`${JSON.stringify(schema, null, 2)}\n`).toMatchFileSnapshot(
      '../../../preset.schema.json',
    );
  });
});

describe('loadPreset', () => {
  it('returns the default without a URL, without fetching', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(loadPreset(undefined)).resolves.toBe(DEFAULT_PRESET);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('loads and validates the preset, bypassing the HTTP cache', async () => {
    mockFetch(Response.json({ modules: ['help'] }));
    await expect(loadPreset('/preset.json')).resolves.toMatchObject({ modules: ['help'] });
    expect(fetch).toHaveBeenCalledWith('/preset.json', { cache: 'no-store' });
  });

  it('throws a ConfigError naming the URL when the preset is missing, broken or invalid', async () => {
    mockFetch(new Response('nope', { status: 404 }));
    await expect(loadPreset('/preset.json')).rejects.toThrow('/preset.json returned HTTP 404');

    mockFetch(new Response('{', { status: 200 }));
    await expect(loadPreset('/preset.json')).rejects.toThrow(ConfigError);

    mockFetch(Response.json({ modules: 'help' }));
    await expect(loadPreset('/preset.json')).rejects.toThrow(/preset\.json is invalid.*modules/s);
  });
});
