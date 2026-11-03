/**
 * Proves that an addon builds outside this repository against the packed packages: packs
 * `@oakestra/api`, `@oakestra/dashboard-sdk` and `@oakestra/ui` (prepack builds `dist/`), copies
 * `addons/example` and generates a fresh addon with `pnpm create:addon --dir` (both outside the
 * workspace), points their `@oakestra/*` dependencies at the tarballs, installs, and runs each
 * addon's typecheck, tests and build.
 *
 * Usage: `pnpm pack:check [--dir <empty directory outside the repository>]`. Without `--dir` it
 * works in a fresh temp directory, removed again on success and kept on failure for inspection.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

import { publishedPackages, repoRoot } from './packages.ts';

const { values: args } = parseArgs({ options: { dir: { type: 'string' } } });

const workDir = args.dir ? resolve(args.dir) : mkdtempSync(join(tmpdir(), 'oakestra-pack-check-'));
// Inside the repository pnpm would treat the copy as part of this workspace and link the
// sources again, which is exactly what this check must not do.
if (workDir === repoRoot || workDir.startsWith(repoRoot + sep)) {
  throw new Error(`--dir must be outside the repository: ${workDir}`);
}
if (args.dir && existsSync(workDir) && readdirSync(workDir).length > 0) {
  throw new Error(`--dir must be empty or missing: ${workDir}`);
}

const tarballDir = join(workDir, 'tarballs');
const exampleDir = join(repoRoot, 'addons/example');

function run(command: string, commandArgs: string[], cwd: string): void {
  console.log(`\n$ ${command} ${commandArgs.join(' ')}  (in ${cwd})`);
  execFileSync(command, commandArgs, { cwd, stdio: 'inherit' });
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

interface PackageJson {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

let succeeded = false;
try {
  // 1. Pack. pnpm applies publishConfig and turns workspace: ranges into versions, exactly as
  // a publish would.
  mkdirSync(tarballDir, { recursive: true });
  const packages = publishedPackages();
  const tarballs = new Map<string, string>();
  for (const pkg of packages) {
    const before = new Set(readdirSync(tarballDir));
    run('pnpm', ['pack', '--pack-destination', tarballDir], pkg.dir);
    const created = readdirSync(tarballDir).filter((file) => !before.has(file));
    if (created.length !== 1)
      throw new Error(`expected one tarball for ${pkg.name}: ${created.join(', ')}`);
    tarballs.set(pkg.name, join(tarballDir, created[0]!));
  }
  // 2. The example addon, copied without anything installed or built, and a fresh one from the
  // `pnpm create:addon --dir` template, so the generator cannot rot unnoticed.
  const exampleCopy = join(workDir, 'addon');
  cpSync(exampleDir, exampleCopy, {
    recursive: true,
    filter: (source) =>
      !['node_modules', 'dist', '.__mf__temp'].includes(basename(source)) || source === exampleDir,
  });
  verifyAddon(exampleCopy, tarballs, 'example addon', true);

  const scaffolded = join(workDir, 'scaffolded');
  run(
    'node',
    ['tools/create-addon/src/cli.ts', 'scaffold-check', '--prefix', 'sc', '--dir', scaffolded],
    repoRoot,
  );
  verifyAddon(scaffolded, tarballs, 'scaffolded addon', false);

  succeeded = true;
  console.log(
    '\npack-check passed: the example addon and a freshly scaffolded one build against the packed packages.',
  );
} finally {
  if (succeeded && !args.dir) rmSync(workDir, { recursive: true, force: true });
  else if (!succeeded) console.error(`\npack-check failed; files are kept in ${workDir}`);
}

/**
 * Points the addon in `addonDir` at the tarballs, installs it and runs what an addon author runs.
 * `inlineTsconfig`: the example still extends the private @oakestra/tsconfig; a scaffolded addon
 * is already self-contained.
 */
function verifyAddon(
  addonDir: string,
  tarballs: Map<string, string>,
  label: string,
  inlineTsconfig: boolean,
): void {
  console.log(`\n=== ${label} ===`);
  const fileSpec = (name: string) =>
    `file:${relative(addonDir, tarballs.get(name)!).split(sep).join('/')}`;

  // 3. Make it standalone. The @oakestra packages come from the tarballs instead of the
  // workspace. @oakestra/tsconfig is private and never published, so its settings are inlined,
  // which is what an addon in its own repository does as well.
  const pkgPath = join(addonDir, 'package.json');
  const pkg = readJson<PackageJson>(pkgPath);
  for (const field of ['dependencies', 'devDependencies'] as const) {
    const deps = pkg[field];
    if (!deps) continue;
    delete deps['@oakestra/tsconfig'];
    for (const name of Object.keys(deps)) {
      if (tarballs.has(name)) deps[name] = fileSpec(name);
      else if (deps[name]!.startsWith('workspace:')) {
        throw new Error(`${name} is a workspace package that is not published`);
      }
    }
  }
  writeJson(pkgPath, pkg);

  const tsconfigPath = join(addonDir, 'tsconfig.json');
  const tsconfig = readJson<{ extends?: string; compilerOptions?: object }>(tsconfigPath);
  if (inlineTsconfig) {
    if (tsconfig.extends !== '@oakestra/tsconfig/react.json') {
      throw new Error(`unexpected tsconfig extends in addons/example: ${tsconfig.extends}`);
    }
    const sharedConfig = (file: string) =>
      readJson<{ compilerOptions: object }>(join(repoRoot, 'packages/tsconfig', file))
        .compilerOptions;
    const { extends: _extends, ...ownConfig } = tsconfig;
    writeJson(tsconfigPath, {
      ...ownConfig,
      compilerOptions: {
        ...sharedConfig('base.json'),
        ...sharedConfig('react.json'),
        ...tsconfig.compilerOptions,
      },
    });
  } else if (tsconfig.extends) {
    throw new Error(`a scaffolded addon must not extend anything: ${tsconfig.extends}`);
  }

  // The SDK depends on @oakestra/api by version, which is not on the registry yet, so the
  // override points it at its tarball. The release-age and build-script settings are the
  // repository's, so the copy resolves the same set of versions the workspace accepts.
  const workspaceSettings = readFileSync(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8')
    .replace(/^packages:\n(?:\s+-.*\n)+/m, '')
    .trim();
  const overrides = [...tarballs.keys()].map((name) => `  '${name}': '${fileSpec(name)}'`);
  writeFileSync(
    join(addonDir, 'pnpm-workspace.yaml'),
    `${workspaceSettings}\noverrides:\n${overrides.join('\n')}\n`,
  );

  // 4. Install and run what an addon author runs.
  run('pnpm', ['install', '--no-frozen-lockfile'], addonDir);

  // Every installed @oakestra package must be the packed build, and every export in its
  // (rewritten) package.json, CSS included, must point at a file that was packed. @oakestra/api is
  // only a dependency of the SDK, so it is found next to the SDK in pnpm's virtual store.
  const directDir = (name: string) => join(addonDir, 'node_modules', name);
  const installedDir = (name: string): string => {
    if (existsSync(directDir(name))) return realpathSync(directDir(name));
    for (const other of tarballs.keys()) {
      if (!existsSync(directDir(other))) continue;
      const sibling = join(dirname(realpathSync(directDir(other))), '..', name);
      if (existsSync(sibling)) return sibling;
    }
    throw new Error(`${name} is not installed in the copy`);
  };
  const exportTargets = (target: unknown): string[] =>
    typeof target === 'string'
      ? [target]
      : target && typeof target === 'object'
        ? Object.values(target).flatMap(exportTargets)
        : [];
  for (const name of tarballs.keys()) {
    const dir = installedDir(name);
    if (existsSync(join(dir, 'src')) || !existsSync(join(dir, 'dist'))) {
      throw new Error(`${name} in the copy is not the packed build: ${dir}`);
    }
    const exports = readJson<{ exports?: Record<string, unknown> }>(
      join(dir, 'package.json'),
    ).exports;
    for (const [subpath, target] of Object.entries(exports ?? {})) {
      for (const file of exportTargets(target)) {
        if (!existsSync(join(dir, file))) {
          throw new Error(`${name} export ${subpath} points at missing ${file}`);
        }
      }
    }
    console.log(`${name}: ${Object.keys(exports ?? {}).length} exports, all files present`);

    // The map subpath is a shared singleton. If the packed lazy wrapper pointed at its sibling
    // file instead, a host built from the tarball would get a second copy of MapLibre.
    if (name === '@oakestra/ui') {
      const impl = readFileSync(join(dir, 'dist/components/location-map-impl.js'), 'utf8');
      if (!/from\s+["']@oakestra\/ui\/map["']/.test(impl)) {
        throw new Error(
          '@oakestra/ui: dist/components/location-map-impl.js must import "@oakestra/ui/map" by its package name',
        );
      }
    }
  }

  // The addon's own typecheck skips declaration files (skipLibCheck) and only sees the entries
  // it imports. This one loads every public entry the addon can import, and through the SDK the
  // whole of @oakestra/api, with skipLibCheck off, so a broken or unresolvable declaration fails.
  const typesDir = join(addonDir, 'pack-check-types');
  mkdirSync(typesDir);
  const typeImports = publishedPackages()
    .filter((published) => existsSync(directDir(published.name)))
    .flatMap((published) =>
      published.entries.map(
        (entry, index) =>
          `export type * as E${published.name.replace(/\W/g, '_')}${index} from '${
            entry.name === 'index' ? published.name : `${published.name}/${entry.name}`
          }';`,
      ),
    );
  writeFileSync(join(typesDir, 'entries.ts'), `${typeImports.join('\n')}\n`);
  writeJson(join(typesDir, 'tsconfig.json'), {
    extends: '../tsconfig.json',
    compilerOptions: { skipLibCheck: false, noEmit: true },
    include: ['entries.ts'],
  });
  run('pnpm', ['exec', 'tsc', '-p', 'pack-check-types/tsconfig.json'], addonDir);

  run('pnpm', ['run', 'typecheck'], addonDir);
  run('pnpm', ['run', 'test'], addonDir);
  run('pnpm', ['run', 'build'], addonDir);
  for (const file of ['remoteEntry.js', 'mf-manifest.json']) {
    if (!existsSync(join(addonDir, 'dist', file))) {
      throw new Error(`the addon build did not emit ${file}`);
    }
  }
}
