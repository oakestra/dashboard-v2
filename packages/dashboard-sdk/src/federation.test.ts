import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { UI_VERSION_FALLBACK, resolveUiVersion, sharedDeps, withoutFallback } from './federation';
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

describe('@oakestra/ui range', () => {
  // Read from disk instead of imported: the SDK must not import from the ui package.
  const uiPkg = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../ui/package.json'), 'utf8'),
  ) as { version: string };
  const uiDir = resolve(import.meta.dirname, '../../ui');

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is resolved from the real ui package, not the fallback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(resolveUiVersion(uiDir)).toBe(uiPkg.version);
    expect(resolveUiVersion(resolve(import.meta.dirname, '../../../addons/example'))).toBe(
      uiPkg.version,
    );
    // Equal to the fallback by design, so only the absence of the warning proves the lookup worked.
    expect(warn).not.toHaveBeenCalled();
  });

  it('reads the version of the ui copy installed in the given directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ui-fixture-'));
    const pkgDir = join(dir, 'node_modules', '@oakestra', 'ui');
    mkdirSync(pkgDir, { recursive: true });
    // Same export map shape as the real package: resolving ./package.json needs the entry.
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@oakestra/ui',
        version: '9.9.9',
        exports: { '.': './index.js', './package.json': './package.json' },
      }),
    );
    expect(resolveUiVersion(dir)).toBe('9.9.9');
  });

  it('falls back with a warning naming the directory when resolution fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // A ui copy without the ./package.json export: the failure this guards against. An empty dir
    // would not do, since pnpm puts the workspace node_modules on NODE_PATH and resolution succeeds.
    const dir = mkdtempSync(join(tmpdir(), 'ui-no-export-'));
    const pkgDir = join(dir, 'node_modules', '@oakestra', 'ui');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: '@oakestra/ui', version: '9.9.9', exports: { '.': './index.js' } }),
    );
    expect(resolveUiVersion(dir)).toBe(UI_VERSION_FALLBACK);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain(dir);
    expect(String(warn.mock.calls[0]?.[0])).toContain(UI_VERSION_FALLBACK);
  });

  it('keeps the fallback equal to the ui package version', () => {
    expect(UI_VERSION_FALLBACK).toBe(uiPkg.version);
  });

  it('applies to the root entry and every subpath', () => {
    const uiEntries = Object.entries(sharedDeps).filter(([name]) =>
      name.startsWith('@oakestra/ui'),
    );
    expect(uiEntries).toHaveLength(5);
    for (const [, config] of uiEntries) {
      expect(config.requiredVersion).toBe(`^${uiPkg.version}`);
    }
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
