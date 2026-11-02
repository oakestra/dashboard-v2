// @vitest-environment node
import { federation } from '@module-federation/vite';
import type { Plugin } from 'vite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sharedDeps, withoutFallback } from './federation';
import { oakestraAddon } from './vite';

vi.mock('@module-federation/vite', () => ({
  federation: vi.fn(() => [{ name: 'module-federation-stub' }]),
}));

beforeEach(() => {
  vi.mocked(federation).mockClear();
});

/** Calls a hook whether the plugin wrote it as a function or as `{ handler }`. */
function callHook(plugin: Plugin, hook: keyof Plugin, context: object, ...args: unknown[]) {
  const value = plugin[hook] as
    ((...a: unknown[]) => unknown) | { handler: (...a: unknown[]) => unknown } | undefined;
  if (value === undefined) throw new Error(`no ${hook} hook`);
  const handler = typeof value === 'function' ? value : value.handler;
  return handler.call(context, ...args);
}

const addonPlugin = (...args: Parameters<typeof oakestraAddon>) => oakestraAddon(...args)[0]!;

describe('oakestraAddon', () => {
  it('configures Module Federation the way the shell loads addons', () => {
    const plugins = oakestraAddon({ name: 'example', prefix: 'ex' });

    expect(plugins.map((plugin) => plugin.name)).toEqual([
      'oakestra-addon',
      'module-federation-stub',
    ]);
    expect(federation).toHaveBeenCalledWith({
      name: 'example',
      filename: 'remoteEntry.js',
      exposes: { './addon': './src/index.tsx' },
      shared: withoutFallback(sharedDeps),
      manifest: true,
      publicPath: 'auto',
      dts: false,
    });
  });

  it('exposes another entry when asked to', () => {
    oakestraAddon({ name: 'insights', prefix: 'ins', entry: './src/addon.tsx' });
    expect(federation).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'insights', exposes: { './addon': './src/addon.tsx' } }),
    );
  });

  it('sets the build and server defaults', () => {
    const plugin = addonPlugin({ name: 'example', prefix: 'ex', port: 5175 });
    expect(callHook(plugin, 'config', {}, {}, { command: 'build', mode: 'production' })).toEqual({
      base: './',
      build: { target: 'esnext' },
      server: { port: 5175, strictPort: true, origin: 'http://localhost:5175', cors: true },
      preview: { port: 5175, strictPort: true, cors: true },
    });
    expect(callHook(plugin, 'config', {}, {}, { command: 'serve', mode: 'development' })).toEqual(
      expect.objectContaining({
        base: '/',
        server: expect.objectContaining({ port: 5175 }) as unknown,
      }),
    );
  });

  it('defaults to port 5174 and lets the own config win', () => {
    const plugin = addonPlugin({ name: 'example', prefix: 'ex' });
    expect(
      callHook(
        plugin,
        'config',
        {},
        { base: '/x/', build: { target: 'es2024' }, server: { port: 6000, cors: false } },
        { command: 'build', mode: 'production' },
      ),
    ).toEqual({
      base: '/x/',
      build: { target: 'es2024' },
      server: { port: 6000, strictPort: true, origin: 'http://localhost:6000', cors: false },
      preview: { port: 6000, strictPort: true, cors: true },
    });
  });

  it('provides the addon name as ADDON_ID', () => {
    const plugin = addonPlugin({ name: 'example', prefix: 'ex' });
    const resolved = callHook(plugin, 'resolveId', {}, 'virtual:oakestra-addon');
    expect(resolved).toBe('\0virtual:oakestra-addon');
    expect(callHook(plugin, 'load', {}, resolved)).toBe('export const ADDON_ID = "example";\n');
    expect(callHook(plugin, 'resolveId', {}, './other')).toBeUndefined();
    expect(callHook(plugin, 'load', {}, '/src/index.tsx')).toBeUndefined();
  });

  it.each([
    [{ name: 'My Addon', prefix: 'ex' }, /name "My Addon" is not a valid addon name/],
    [{ name: '', prefix: 'ex' }, /not a valid addon name/],
    [{ name: 'example', prefix: 'Ex' }, /prefix "Ex" is not a valid Tailwind prefix/],
    [{ name: 'example', prefix: 'ex', port: 0 }, /port 0 is not a valid port/],
  ])('rejects %j', (options, message) => {
    expect(() => oakestraAddon(options)).toThrow(message);
  });
});

describe('the prefix check', () => {
  const asset = (fileName: string, source: string | Uint8Array) => ({
    type: 'asset',
    fileName,
    source,
  });

  function generateBundle(bundle: Record<string, object>) {
    const plugin = addonPlugin({ name: 'example', prefix: 'ex' });
    const context = {
      error: (message: string) => {
        throw new Error(message);
      },
    };
    return () => callHook(plugin, 'generateBundle', context, {}, bundle);
  }

  it('fails the build for CSS assets with unprefixed classes', () => {
    const run = generateBundle({
      'assets/ok.css': asset('assets/ok.css', String.raw`.ex\:flex{display:flex}`),
      'assets/bad.css': asset(
        'assets/bad.css',
        new TextEncoder().encode(String.raw`.ex\:flex{display:flex}.hidden{display:none}`),
      ),
      // Not CSS, even though it contains a selector-like string.
      'assets/index.js': { type: 'chunk', fileName: 'assets/index.js', code: '".hidden{"' },
      'assets/notes.txt': asset('assets/notes.txt', '.hidden{display:none}'),
    });
    expect(run).toThrow(
      /^assets\/bad\.css: 1 class selector without the addon prefix "ex:":\n {2}\.hidden\n/,
    );
  });

  it('passes a clean bundle', () => {
    expect(
      generateBundle({ 'a.css': asset('a.css', String.raw`.ex\:flex{display:flex}`) }),
    ).not.toThrow();
  });

  it('warns in dev, once per version of a stylesheet', () => {
    const plugin = addonPlugin({ name: 'example', prefix: 'ex' });
    callHook(plugin, 'configResolved', {}, { root: '/repo/addons/x', command: 'serve' });
    const warn = vi.fn();
    const transform = (code: string, id = '/repo/addons/x/src/addon.css') =>
      callHook(plugin, 'transform', { warn }, code, id);

    const css = String.raw`.ex\:flex{display:flex}.hidden{display:none}`;
    transform(css);
    transform(css);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^src\/addon\.css: 1 class selector/));

    transform(`${css}.flex{display:flex}`);
    expect(warn).toHaveBeenCalledTimes(2);

    // Fixed and broken again: a new warning.
    transform(String.raw`.ex\:flex{display:flex}`);
    transform(css);
    expect(warn).toHaveBeenCalledTimes(3);

    transform(css, '/repo/addons/x/src/addon.css?raw');
    transform(css, '/repo/addons/x/src/index.tsx');
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it('does not check CSS while building, generateBundle does', () => {
    const plugin = addonPlugin({ name: 'example', prefix: 'ex' });
    callHook(plugin, 'configResolved', {}, { root: '/repo', command: 'build' });
    const warn = vi.fn();
    callHook(plugin, 'transform', { warn }, '.hidden{display:none}', '/repo/src/addon.css');
    expect(warn).not.toHaveBeenCalled();
  });
});
