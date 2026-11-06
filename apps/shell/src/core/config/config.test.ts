import { describe, expect, it, vi } from 'vitest';

import { ConfigError, loadConfig, mapStylesFromConfig } from './config';

function mockFetch(response: Response | Error) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
}

describe('loadConfig', () => {
  it('applies defaults', async () => {
    mockFetch(Response.json({ apiUrl: '/api' }));
    await expect(loadConfig()).resolves.toEqual({
      apiUrl: '/api',
      uiAddonsUrl: '/ui-addons',
      addonsManagerUrl: '/addons-api',
      marketplaceUrl: '/marketplace-api',
      addonsPollIntervalMs: 15_000,
    });
  });

  it('treats empty optional links as unset and validates the others', async () => {
    mockFetch(Response.json({ apiUrl: '/api', grafanaUrl: '', presetUrl: '' }));
    const config = await loadConfig();
    expect(config.grafanaUrl).toBeUndefined();
    expect(config.presetUrl).toBeUndefined();

    mockFetch(Response.json({ apiUrl: '/api', presetUrl: '/preset.json' }));
    await expect(loadConfig()).resolves.toMatchObject({ presetUrl: '/preset.json' });

    mockFetch(Response.json({ apiUrl: '/api', grafanaUrl: 'javascript:alert(1)' }));
    await expect(loadConfig()).rejects.toThrow(/grafanaUrl/);
  });

  it('rejects a config without apiUrl', async () => {
    mockFetch(Response.json({}));
    await expect(loadConfig()).rejects.toBeInstanceOf(ConfigError);
  });

  it('reports HTTP errors', async () => {
    mockFetch(new Response('nope', { status: 404 }));
    await expect(loadConfig()).rejects.toThrow(/HTTP 404/);
  });

  it('treats empty map styles as not configured and rejects other schemes', async () => {
    mockFetch(Response.json({ apiUrl: '/api', mapStyleUrl: '', mapStyleDarkUrl: '' }));
    expect(mapStylesFromConfig(await loadConfig())).toBeUndefined();

    mockFetch(Response.json({ apiUrl: '/api', mapStyleUrl: 'javascript:alert(1)' }));
    await expect(loadConfig()).rejects.toThrow(/mapStyleUrl/);
  });
});

describe('mapStylesFromConfig', () => {
  const light = 'https://tiles.example/light.json';
  const dark = 'https://tiles.example/dark.json';

  it('uses both styles when both are set', () => {
    expect(mapStylesFromConfig({ mapStyleUrl: light, mapStyleDarkUrl: dark })).toEqual({
      light,
      dark,
    });
  });

  // Filling the gap from the public default would leak viewers of a self-hosted deployment to a
  // third party when they switch themes.
  it('never mixes a configured style with the public default', () => {
    expect(mapStylesFromConfig({ mapStyleUrl: light })).toEqual({ light, dark: light });
    expect(mapStylesFromConfig({ mapStyleDarkUrl: dark })).toEqual({ light: dark, dark });
  });
});
