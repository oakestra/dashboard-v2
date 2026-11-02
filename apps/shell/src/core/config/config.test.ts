import { describe, expect, it, vi } from 'vitest';

import { ConfigError, loadConfig } from './config';

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
    mockFetch(Response.json({ apiUrl: '/api', grafanaUrl: '' }));
    const config = await loadConfig();
    expect(config.grafanaUrl).toBeUndefined();

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
});
