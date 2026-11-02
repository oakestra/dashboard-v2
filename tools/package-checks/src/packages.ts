import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const repoRoot = resolve(import.meta.dirname, '../../..');

/** Workspace directories of the packages addons install from npm once they are published. */
export const publishedPackageDirs = ['packages/api', 'packages/dashboard-sdk', 'packages/ui'];

export interface PublishedEntry {
  /** Export subpath without the leading `./`, `index` for the root entry. */
  name: string;
  /** Declaration file of the entry, relative to the package directory. */
  types: string;
}

export interface PublishedPackage {
  name: string;
  dir: string;
  entries: readonly PublishedEntry[];
}

interface PackageJson {
  name: string;
  publishConfig?: { exports?: Record<string, string | { types?: string }> };
}

/**
 * Reads the public JS entries from `publishConfig.exports`, the map consumers actually see, so a
 * new subpath is covered by the API report without touching this tool. CSS and `package.json`
 * exports have no `types` condition and are skipped.
 */
export function readPublishedPackage(relativeDir: string): PublishedPackage {
  const dir = resolve(repoRoot, relativeDir);
  const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as PackageJson;
  const exports = pkg.publishConfig?.exports;
  if (!exports) throw new Error(`${pkg.name} has no publishConfig.exports`);
  const entries = Object.entries(exports).flatMap(([subpath, target]) =>
    typeof target === 'object' && target.types
      ? [{ name: subpath === '.' ? 'index' : subpath.replace(/^\.\//, ''), types: target.types }]
      : [],
  );
  return { name: pkg.name, dir, entries };
}

export const publishedPackages = (): PublishedPackage[] =>
  publishedPackageDirs.map(readPublishedPackage);
