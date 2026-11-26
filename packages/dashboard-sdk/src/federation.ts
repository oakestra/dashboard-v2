/**
 * Module Federation `shared` configuration used by the shell and by every addon.
 *
 * This file is loaded from vite.config.ts by Node itself (Vite does not bundle linked workspace
 * packages into the config), so it must not import anything browser-only, and its relative imports
 * need the explicit `.ts` extension that Node's type stripping requires.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { SDK_VERSION } from './version.ts';

export interface SharedDependencyConfig {
  singleton: true;
  requiredVersion: string;
  /** `false` means "never bundle a fallback, always take the host's copy". */
  import?: false;
}

export type SharedDependencies = Readonly<Record<string, SharedDependencyConfig>>;

/**
 * Range for a package that follows semver. Below 1.0.0 a caret pins the minor version
 * (`^0.1.0` is `>=0.1.0 <0.2.0`), which matches this repo's policy that a 0.x minor may break.
 */
function caretRange(version: string): string {
  return `^${version}`;
}

/**
 * Version of `@oakestra/ui` used when it cannot be resolved. A unit test keeps it equal to
 * packages/ui/package.json, so it only matters for setups where resolution fails.
 */
export const UI_VERSION_FALLBACK = '0.1.0';

/**
 * Version of the `@oakestra/ui` that `fromDir` builds against.
 *
 * The range has to describe the ui copy the addon is compiled with, not the one the SDK happened
 * to be released next to: once the SDK comes from npm, the two can differ. Resolving from the
 * consuming project finds the right one in the monorepo and in an addon's own repo. Any failure
 * (not installed, hoisting quirks, a package.json without a version) falls back to the constant
 * instead of breaking the build config, because a slightly stale range is better than no build.
 */
export function resolveUiVersion(fromDir: string = process.cwd()): string {
  try {
    // resolve + read instead of require(): the SDK must not depend on ui sources, and this is a
    // build-time lookup of the consumer's copy, not an import.
    const resolver = createRequire(join(fromDir, 'noop.js'));
    const pkg = JSON.parse(readFileSync(resolver.resolve('@oakestra/ui/package.json'), 'utf8')) as {
      version?: unknown;
    };
    if (typeof pkg.version === 'string' && pkg.version !== '') return pkg.version;
  } catch {
    // Swallowed on purpose: a stale range beats a broken build config. The warning below says so.
  }
  console.warn(
    `[dashboard-sdk] Could not resolve @oakestra/ui/package.json from ${fromDir}; ` +
      `using the fallback version ${UI_VERSION_FALLBACK} for the shared ui range.`,
  );
  return UI_VERSION_FALLBACK;
}

const uiRange = caretRange(resolveUiVersion());

/**
 * Libraries that hold global state (React's dispatcher, router and query contexts, the SDK's own
 * contexts, Radix providers inside @oakestra/ui) and therefore must exist exactly once on the page.
 *
 * Subpath imports such as `react/jsx-runtime` and `react-dom/client` are picked up automatically by
 * @module-federation/vite and inherit the settings of their package.
 */
export const sharedDeps: SharedDependencies = {
  react: { singleton: true, requiredVersion: '^19.0.0' },
  'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
  'react-router': { singleton: true, requiredVersion: '^8.0.0' },
  '@tanstack/react-query': { singleton: true, requiredVersion: '^5.0.0' },
  '@oakestra/dashboard-sdk': { singleton: true, requiredVersion: caretRange(SDK_VERSION) },
  '@oakestra/ui': { singleton: true, requiredVersion: uiRange },
  // Heavy optional parts of the UI library. Separate shared modules so the host only fetches
  // them for pages that import them; addons import the same specifiers and reuse the host copy.
  '@oakestra/ui/chart': { singleton: true, requiredVersion: uiRange },
  '@oakestra/ui/data-table': { singleton: true, requiredVersion: uiRange },
  '@oakestra/ui/command': { singleton: true, requiredVersion: uiRange },
  '@oakestra/ui/map': { singleton: true, requiredVersion: uiRange },
  // The lazy LocationMap wrapper. Its own module so importing it does not pull in `ui/map`.
  '@oakestra/ui/location-map': { singleton: true, requiredVersion: uiRange },
  // The lazy FlowGraph wrapper; React Flow and dagre load only when a graph renders.
  '@oakestra/ui/flow': { singleton: true, requiredVersion: uiRange },
};

/**
 * Turns the shared config into "host provided only" (`import: false`).
 *
 * Addons only ever run inside the shell, so bundling fallbacks would just ship dead code and,
 * worse, could silently give an addon a second React if sharing were misconfigured. Without a
 * fallback such a mistake fails loudly at load time instead.
 */
export function withoutFallback(shared: SharedDependencies): SharedDependencies {
  return Object.fromEntries(
    Object.entries(shared).map(([name, config]) => [name, { ...config, import: false as const }]),
  );
}
