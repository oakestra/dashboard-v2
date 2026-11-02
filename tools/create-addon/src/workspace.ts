import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { WorkspaceState } from './options.ts';

export const repoRoot = resolve(import.meta.dirname, '../../..');
export const templateRoot = resolve(import.meta.dirname, '../template');

const read = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '');

/** `prefix: 'ex'` in vite.config.ts, or `prefix(ex)` in src/addon.css as a fallback. */
export function readPrefix(viteConfig: string, addonCss: string): string | undefined {
  return (
    /\bprefix:\s*['"]([a-z]+)['"]/.exec(viteConfig)?.[1] ??
    /\bprefix\(([a-z]+)\)/.exec(addonCss)?.[1]
  );
}

export function readPort(viteConfig: string): number | undefined {
  const port = /\bport:\s*(\d+)/.exec(viteConfig)?.[1];
  return port ? Number(port) : undefined;
}

export function readWorkspaceState(root = repoRoot): WorkspaceState {
  const addonsDir = join(root, 'addons');
  const addonNames = existsSync(addonsDir)
    ? readdirSync(addonsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];
  const prefixes: string[] = [];
  const ports: number[] = [];
  for (const name of addonNames) {
    const viteConfig = read(join(addonsDir, name, 'vite.config.ts'));
    const prefix = readPrefix(viteConfig, read(join(addonsDir, name, 'src/addon.css')));
    const port = readPort(viteConfig);
    if (prefix) prefixes.push(prefix);
    if (port) ports.push(port);
  }
  return { addonNames, prefixes, ports };
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
