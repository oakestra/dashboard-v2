import { afterEach, describe, expect, it, vi } from 'vitest';

import { addonEntryUrl } from './addons/ui-addons';
import { routerBasename, sitePath } from './base-path';

afterEach(() => vi.unstubAllEnvs());

describe('base path', () => {
  it('changes nothing at the root', () => {
    expect(sitePath('/config.json')).toBe('/config.json');
    expect(routerBasename()).toBeUndefined();
    expect(addonEntryUrl('example', 'https://dash.test')).toBe(
      'https://dash.test/addon-assets/example/mf-manifest.json',
    );
  });

  it('prefixes site files and the router below a subpath', () => {
    vi.stubEnv('BASE_URL', '/dashboard-v2/');
    expect(sitePath('/config.json')).toBe('/dashboard-v2/config.json');
    expect(sitePath('brand/logo.png')).toBe('/dashboard-v2/brand/logo.png');
    expect(routerBasename()).toBe('/dashboard-v2');
    expect(addonEntryUrl('carbon', 'https://org.github.io')).toBe(
      'https://org.github.io/dashboard-v2/addon-assets/carbon/mf-manifest.json',
    );
  });
});
