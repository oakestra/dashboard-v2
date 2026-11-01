import { describe, expect, it } from 'vitest';

import { sharedDeps, withoutFallback } from './federation';
import { SDK_VERSION } from './version';

describe('sharedDeps', () => {
  it('shares every stateful library as a singleton', () => {
    expect(Object.keys(sharedDeps).sort()).toEqual(
      [
        '@oakestra/dashboard-sdk',
        '@oakestra/ui',
        '@oakestra/ui/chart',
        '@oakestra/ui/command',
        '@oakestra/ui/data-table',
        '@oakestra/ui/map',
        '@tanstack/react-query',
        'react',
        'react-dom',
        'react-router',
      ].sort(),
    );
    for (const config of Object.values(sharedDeps)) {
      expect(config.singleton).toBe(true);
    }
  });

  it('requires a compatible SDK version', () => {
    expect(sharedDeps['@oakestra/dashboard-sdk']?.requiredVersion).toBe(`^${SDK_VERSION}`);
  });
});

describe('withoutFallback', () => {
  it('disables the local fallback for every dependency without touching the input', () => {
    const result = withoutFallback(sharedDeps);
    for (const [name, config] of Object.entries(result)) {
      expect(config).toEqual({ ...sharedDeps[name], import: false });
    }
    expect(Object.values(sharedDeps).some((config) => 'import' in config)).toBe(false);
  });
});
