import { describe, expect, it, vi } from 'vitest';

import { addonEntryUrl, fetchUiAddons, parseUiAddons, UiAddonsUnavailableError } from './ui-addons';

describe('parseUiAddons', () => {
  it('keeps valid entries and drops invalid or duplicate ones', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseUiAddons([
      { name: 'flops', version: '1.0.0', sdk: '^1.0.0', extra: 'ignored' },
      { name: 'Bad Name', version: '1.0.0', sdk: '^1.0.0' },
      { name: 'nosdk', version: '1.0.0', sdk: 'not a range' },
      { name: 'flops', version: '2.0.0', sdk: '^1.0.0' },
    ]);
    expect(result).toEqual([{ name: 'flops', version: '1.0.0', sdk: '^1.0.0' }]);
  });

  it('treats a non-array body as unavailable', () => {
    expect(() => parseUiAddons({ message: 'nope' })).toThrow(UiAddonsUnavailableError);
  });
});

describe('fetchUiAddons', () => {
  it.each([404, 502])('reports HTTP %i as unavailable', async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status }));
    await expect(fetchUiAddons('/ui-addons')).rejects.toBeInstanceOf(UiAddonsUnavailableError);
  });

  it('reports network errors as unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchUiAddons('/ui-addons')).rejects.toBeInstanceOf(UiAddonsUnavailableError);
  });

  it('returns the parsed list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json([{ name: 'flops', version: '1.0.0', sdk: '^0.1.0' }]),
    );
    await expect(fetchUiAddons('/ui-addons')).resolves.toEqual([
      { name: 'flops', version: '1.0.0', sdk: '^0.1.0' },
    ]);
  });
});

describe('addonEntryUrl', () => {
  it('builds an absolute manifest URL below /addon-assets', () => {
    expect(addonEntryUrl('flops', 'https://dash.example')).toBe(
      'https://dash.example/addon-assets/flops/mf-manifest.json',
    );
  });
});
