/**
 * Module Federation `shared` configuration used by the shell and by every addon.
 *
 * This file is loaded from vite.config.ts by Node itself (Vite does not bundle linked workspace
 * packages into the config), so it must not import anything browser-only, and its relative imports
 * need the explicit `.ts` extension that Node's type stripping requires.
 */
import { SDK_VERSION } from './version.ts';

export interface SharedDependencyConfig {
  singleton: true;
  requiredVersion: string;
  /** `false` means "never bundle a fallback, always take the host's copy". */
  import?: false;
}

export type SharedDependencies = Readonly<Record<string, SharedDependencyConfig>>;

/** Minor version range for a 0.x package, where a minor bump is allowed to break. */
function caretRange(version: string): string {
  return `^${version}`;
}

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
  '@oakestra/ui': { singleton: true, requiredVersion: '^0.1.0' },
  // Heavy optional parts of the UI library. Separate shared modules so the host only fetches
  // them for pages that import them; addons import the same specifiers and reuse the host copy.
  '@oakestra/ui/chart': { singleton: true, requiredVersion: '^0.1.0' },
  '@oakestra/ui/data-table': { singleton: true, requiredVersion: '^0.1.0' },
  '@oakestra/ui/command': { singleton: true, requiredVersion: '^0.1.0' },
  '@oakestra/ui/map': { singleton: true, requiredVersion: '^0.1.0' },
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
