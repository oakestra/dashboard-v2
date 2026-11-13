import { describe, expect, it } from 'vitest';

import { addonLabel, type AddonEntry } from './addon-registry';

const base = {
  name: 'flops',
  version: '1.0.0',
  sdk: '^0.1.0',
  entry: 'https://dash.test/addon-assets/flops/mf-manifest.json',
  origin: 'manager',
  basePath: '/addons/flops',
} as const;

describe('addonLabel', () => {
  it("prefers the UI's own label, then the catalog display name, then the name", () => {
    const loaded = (label?: string): AddonEntry => ({
      ...base,
      display_name: 'Federated Learning',
      state: 'loaded',
      definition: { id: 'flops', label },
    });
    expect(addonLabel(loaded('FLOps'))).toBe('FLOps');
    expect(addonLabel(loaded())).toBe('Federated Learning');
    expect(addonLabel({ ...base, display_name: 'Federated Learning', state: 'loading' })).toBe(
      'Federated Learning',
    );
    expect(addonLabel({ ...base, state: 'failed', error: 'boom' })).toBe('flops');
  });
});
