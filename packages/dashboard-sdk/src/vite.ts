/**
 * Vite plugin for addon UIs: the Module Federation setup the shell expects, the build defaults
 * that go with it, a check that the addon's CSS cannot override the shell's classes, and the addon
 * name as a module, so the definition id and the federation name come from one place.
 *
 * Loaded by Node from an addon's vite.config.ts (like `./federation`): no browser-only imports,
 * explicit `.ts` extensions on relative imports. Not part of `sharedDeps`, it never runs in the
 * browser.
 */
import { relative } from 'node:path';

import { federation } from '@module-federation/vite';
import type { Plugin, UserConfig } from 'vite';

import { assertValidPrefix, checkClassPrefix, describePrefixProblem } from './css-prefix.ts';
import { sharedDeps, withoutFallback } from './federation.ts';

export interface OakestraAddonOptions {
  /**
   * The addon name: the Module Federation container name, the name in `/ui-addons` and the
   * container suffix (`addonui-<name>`). Lowercase letters, digits and `-`. Source files get it
   * as `ADDON_ID` from `virtual:oakestra-addon` for `defineAddon({ id: ADDON_ID })`.
   */
  name: string;
  /**
   * The Tailwind prefix of the addon's classes, the same value as `prefix(...)` on the
   * `tailwindcss/theme.css` import in addon.css. Lowercase letters only. The build fails when the
   * emitted CSS contains a class selector without it.
   */
  prefix: string;
  /** The module exposed as `./addon`, whose default export is `defineAddon({...})`. */
  entry?: string;
  /** Port of `vite` (dev) and `vite preview`. Give every addon its own, `strictPort` is on. */
  port?: number;
}

/** Exports `ADDON_ID`; its types are in `@oakestra/dashboard-sdk/vite/client`. */
const ADDON_ID_MODULE = 'virtual:oakestra-addon';

const RESOLVED_ADDON_ID_MODULE = `\0${ADDON_ID_MODULE}`;

/** The rule of the shell for `/ui-addons` names and of the nginx `/addon-assets/<name>/` proxy. */
const ADDON_NAME = /^[a-z0-9-]+$/;

const CSS_REQUEST = /\.css(?:$|\?)/;
const NOT_STYLESHEET = /[?&](?:raw|url)\b/;

/**
 * Plugins for an addon UI's vite.config.ts, next to `react()` and `tailwindcss()`:
 *
 * ```ts
 * plugins: [react(), tailwindcss(), oakestraAddon({ name: 'insights', prefix: 'ins', port: 5175 })]
 * ```
 *
 * Settings of your own vite.config.ts win over the defaults set here (`base`, `build.target`,
 * `server`, `preview`). The federation options are the contract with the shell and fixed.
 */
export function oakestraAddon(options: OakestraAddonOptions): Plugin[] {
  const { name, prefix, entry = './src/index.tsx', port = 5174 } = options;
  if (typeof name !== 'string' || !ADDON_NAME.test(name)) {
    throw new Error(
      `oakestraAddon(): name ${JSON.stringify(name)} is not a valid addon name. Use lowercase ` +
        `letters, digits and "-" (^[a-z0-9-]+$): it must equal the addon name in /ui-addons.`,
    );
  }
  assertValidPrefix(prefix);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`oakestraAddon(): port ${JSON.stringify(port)} is not a valid port.`);
  }

  let root = process.cwd();
  let serving = false;
  // Dev warns once per stylesheet version: Tailwind regenerates the CSS on every new class.
  const lastWarning = new Map<string, string>();

  const addon: Plugin = {
    name: 'oakestra-addon',

    config(userConfig, { command }): UserConfig {
      const { server = {}, preview = {}, build = {} } = userConfig;
      const devPort = server.port ?? port;
      return {
        // Relative asset URLs in production, where the addon is served below
        // /addon-assets/<name>/; absolute ones from the dev server.
        base: userConfig.base ?? (command === 'build' ? './' : '/'),
        // The federation runtime uses top-level await.
        build: { target: build.target ?? 'esnext' },
        server: {
          port: devPort,
          strictPort: server.strictPort ?? true,
          // The shell runs on another origin. `origin` makes dev asset URLs absolute, otherwise
          // the browser asks the shell for them.
          origin: server.origin ?? `http://localhost:${devPort}`,
          cors: server.cors ?? true,
        },
        preview: {
          port: preview.port ?? devPort,
          strictPort: preview.strictPort ?? true,
          cors: preview.cors ?? true,
        },
      };
    },

    configResolved(config) {
      root = config.root;
      serving = config.command === 'serve';
    },

    resolveId(id) {
      return id === ADDON_ID_MODULE ? RESOLVED_ADDON_ID_MODULE : undefined;
    },

    load(id) {
      return id === RESOLVED_ADDON_ID_MODULE
        ? `export const ADDON_ID = ${JSON.stringify(name)};\n`
        : undefined;
    },

    // Runs after Tailwind and vite:css, before vite:css-post turns the stylesheet into JS, so the
    // code is the generated CSS. Dev only warns: failing here would break the page on every save
    // of a comment that mentions a class.
    transform(code, id) {
      if (!serving || !CSS_REQUEST.test(id) || NOT_STYLESHEET.test(id)) return;
      const file = relative(root, id.replace(/\?.*$/, ''));
      const problem = describePrefixProblem(file, prefix, checkClassPrefix(code, prefix));
      if (problem === undefined) lastWarning.delete(id);
      else if (lastWarning.get(id) !== problem) {
        lastWarning.set(id, problem);
        this.warn(problem);
      }
    },

    generateBundle: {
      order: 'post',
      handler(_outputOptions, bundle) {
        const problems: string[] = [];
        for (const output of Object.values(bundle)) {
          if (output.type !== 'asset' || !output.fileName.endsWith('.css')) continue;
          const css =
            typeof output.source === 'string'
              ? output.source
              : new TextDecoder().decode(output.source);
          const problem = describePrefixProblem(
            output.fileName,
            prefix,
            checkClassPrefix(css, prefix),
          );
          if (problem !== undefined) problems.push(problem);
        }
        if (problems.length > 0) this.error(problems.join('\n\n'));
      },
    },
  };

  return [
    addon,
    // Returns no plugins under Vitest, so the same plugin list works in vitest.config.ts.
    ...(federation({
      name,
      filename: 'remoteEntry.js',
      exposes: { './addon': entry },
      // The addon only ever runs inside the shell, so it never ships its own React, SDK, etc.
      shared: { ...withoutFallback(sharedDeps) },
      // The shell loads addons by mf-manifest.json; chunk URLs resolve relative to it, so the
      // same build works below /addon-assets/<name>/ and from a dev server.
      manifest: true,
      publicPath: 'auto',
      dts: false,
    }) as Plugin[]),
  ];
}
