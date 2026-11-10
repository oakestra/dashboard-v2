/**
 * Publishes `@oakestra/api`, `@oakestra/dashboard-sdk` and `@oakestra/ui` to npm. Runs in CI
 * (`release-packages.yml`), which provides the OIDC token for trusted publishing and provenance.
 *
 *   publish.ts                 the versions in package.json, dist-tag latest
 *   publish.ts --snapshot <n>  <next patch>-main.<n>, dist-tag next
 *
 * A version that is already on npm is skipped, so a rerun after a partial failure picks up
 * where the last run stopped. Releases also get a local git tag `<name>@<version>`; the
 * workflow pushes them.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { publishedPackageDirs, repoRoot } from './packages.ts';

const { values: args } = parseArgs({ options: { snapshot: { type: 'string' } } });
const snapshotId = args.snapshot;
if (snapshotId !== undefined && !/^[1-9]\d*$/.test(snapshotId)) {
  throw new Error(`--snapshot needs a positive integer (the CI run number), got "${snapshotId}"`);
}

interface PackageJson {
  name: string;
  version: string;
  license?: string;
  repository?: unknown;
}

const packages = publishedPackageDirs.map((relativeDir) => {
  const dir = resolve(repoRoot, relativeDir);
  const path = join(dir, 'package.json');
  return { dir, path, pkg: JSON.parse(readFileSync(path, 'utf8')) as PackageJson };
});

// Without a license nobody can legally use the package. npm rejects provenance when
// `repository` doesn't match the repo that publishes.
for (const { pkg } of packages) {
  if (!pkg.license) throw new Error(`${pkg.name} has no "license" in package.json`);
  if (!pkg.repository) throw new Error(`${pkg.name} has no "repository" in package.json`);
}

if (snapshotId !== undefined) {
  // All three get their snapshot version before anything is packed, because packing turns the
  // SDK's `workspace:^` range on @oakestra/api into the api's version at that moment.
  for (const entry of packages) {
    entry.pkg.version = snapshotVersion(entry.pkg.version, snapshotId);
    writeFileSync(entry.path, `${JSON.stringify(entry.pkg, null, 2)}\n`);
  }
}

const distTag = snapshotId === undefined ? 'latest' : 'next';
const tarballDir = mkdtempSync(join(tmpdir(), 'oakestra-publish-'));

// publishedPackageDirs lists @oakestra/api before the SDK that depends on it.
for (const { dir, pkg } of packages) {
  const id = `${pkg.name}@${pkg.version}`;
  if (isPublished(id)) {
    console.log(`${id} is already on npm, skipping`);
    continue;
  }
  // pnpm, not npm, packs: it applies publishConfig and rewrites workspace: ranges. npm then
  // uploads the tarball, since it is what speaks OIDC to the registry.
  const before = new Set(readdirSync(tarballDir));
  execFileSync('pnpm', ['pack', '--pack-destination', tarballDir], { cwd: dir, stdio: 'inherit' });
  const tarball = readdirSync(tarballDir).find((file) => !before.has(file));
  if (!tarball) throw new Error(`pnpm pack wrote no tarball for ${id}`);

  execFileSync(
    'npm',
    ['publish', join(tarballDir, tarball), '--access', 'public', '--provenance', '--tag', distTag],
    { stdio: 'inherit' },
  );
  console.log(`published ${id} (${distTag})`);
  if (snapshotId === undefined) execFileSync('git', ['tag', id], { stdio: 'inherit' });
}

/** 0.1.0 -> 0.1.1-main.42, which sorts after 0.1.0 and before any 0.1.1 release. */
function snapshotVersion(version: string, id: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`cannot derive a snapshot from version ${version}`);
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}-main.${id}`;
}

function isPublished(id: string): boolean {
  try {
    // Prints nothing (exit 0) when the package exists but this version does not.
    return execFileSync('npm', ['view', id, 'version'], { stdio: 'pipe' }).toString().trim() !== '';
  } catch (error) {
    // Anything but "not found" (network, auth) must stop the run instead of publishing blind.
    const stderr = String((error as { stderr?: Buffer }).stderr ?? '');
    if (stderr.includes('E404')) return false;
    throw error;
  }
}
