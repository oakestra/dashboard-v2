import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';

import type { AddonOptions } from './options.ts';
import { renderTree } from './render.ts';
import { readJson, repoRoot, templateRoot } from './workspace.ts';

interface PackageJson {
  version?: string;
  packageManager?: string;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

const tsconfigOptions = (file: string) =>
  readJson<{ compilerOptions: Record<string, unknown> }>(join(repoRoot, 'packages/tsconfig', file))
    .compilerOptions;

/**
 * The addon's own compiler options: `@oakestra/tsconfig` is private and never published, so a
 * standalone addon gets its content inlined, like the pack check does for the example.
 */
function standaloneTsconfig(): string {
  const workspace = readJson<{ compilerOptions: object }>(
    join(templateRoot, 'workspace/tsconfig.json'),
  );
  return `${JSON.stringify(
    {
      compilerOptions: {
        ...tsconfigOptions('base.json'),
        ...tsconfigOptions('react.json'),
        ...workspace.compilerOptions,
      },
      include: ['src', 'vite.config.ts', 'vitest.config.ts'],
    },
    null,
    2,
  )}\n`;
}

export function placeholderValues(options: AddonOptions): Record<string, string> {
  const standalone = options.dir !== undefined;
  const sdk = readJson<PackageJson>(join(repoRoot, 'packages/dashboard-sdk/package.json'));
  const ui = readJson<PackageJson>(join(repoRoot, 'packages/ui/package.json'));
  const root = readJson<PackageJson>(join(repoRoot, 'package.json'));
  return {
    NAME: options.name,
    PREFIX: options.prefix,
    LABEL: options.label,
    PORT: String(options.port),
    PACKAGE_NAME: standalone ? `oakestra-addon-${options.name}` : `@oakestra/addon-${options.name}`,
    SDK_DEP: standalone ? `^${sdk.version}` : 'workspace:*',
    UI_DEP: standalone ? `^${ui.version}` : 'workspace:*',
    // What the definition tells the addons manager the UI was built against.
    SDK_RANGE: `^${sdk.version}`,
    PNPM_VERSION: root.packageManager?.replace(/^pnpm@/, '') ?? 'latest',
  };
}

export function targetDir(options: AddonOptions): string {
  return options.dir ?? join(repoRoot, 'addons', options.name);
}

/** Refuses anything that could overwrite or mix with existing files, then writes the addon. */
export function scaffold(options: AddonOptions): { dir: string; files: string[] } {
  const dir = targetDir(options);
  if (existsSync(dir) && readdirSync(dir).length > 0) {
    throw new Error(`${dir} already exists and is not empty. Nothing was changed.`);
  }
  if (options.dir !== undefined && (dir === repoRoot || dir.startsWith(repoRoot + sep))) {
    // Inside the repository pnpm would take the addon for a workspace package and link sources.
    throw new Error(`--dir must be outside the repository: ${dir}`);
  }

  const standalone = options.dir !== undefined;
  const values = placeholderValues(options);
  const files = renderTree(
    [join(templateRoot, 'common'), join(templateRoot, standalone ? 'standalone' : 'workspace')],
    dir,
    values,
    { gitignore: '.gitignore', dockerignore: '.dockerignore' },
  );
  if (standalone) postProcessStandalone(dir, files);
  return { dir, files };
}

function postProcessStandalone(dir: string, files: string[]): void {
  writeFileSync(join(dir, 'tsconfig.json'), standaloneTsconfig());
  const pkgPath = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJson;
  delete pkg.devDependencies?.['@oakestra/tsconfig'];
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  files.push('tsconfig.json');
}
