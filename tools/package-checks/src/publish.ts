/**
 * Publishes `@oakestra/api`, `@oakestra/dashboard-sdk` and `@oakestra/ui` to GitHub Packages,
 * and to npmjs.com too when PUBLISH_TO_NPMJS is "true". Runs in CI (`release-packages.yml`),
 * which sets up the auth for both.
 *
 *   publish.ts                 versions in package.json, dist-tag latest, or the prerelease
 *                              name for a prerelease (0.3.0-beta.1 -> beta, Changesets pre mode)
 *   publish.ts --snapshot <n>  <next patch>-canary.<n>, dist-tag canary
 *
 * A version already in a registry is skipped there, so a rerun after a partial failure picks up
 * where the last run stopped. Releases also get a local git tag `<name>@<version>`; the
 * workflow pushes them.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { publishedPackageDirs, repoRoot } from './packages.ts';

const GITHUB = 'https://npm.pkg.github.com/';
const NPMJS = 'https://registry.npmjs.org/';

const { values: args } = parseArgs({ options: { snapshot: { type: 'string' } } });
const snapshotId = args.snapshot;
if (snapshotId !== undefined && !/^[1-9]\d*$/.test(snapshotId)) {
  throw new Error(`--snapshot needs a positive integer (the CI run number), got "${snapshotId}"`);
}
const registries = process.env.PUBLISH_TO_NPMJS === 'true' ? [GITHUB, NPMJS] : [GITHUB];

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

// Without a license nobody can legally use the package. `repository` links the package to this
// repo on GitHub, and npm rejects provenance when it doesn't match the repo that publishes.
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

const tarballDir = mkdtempSync(join(tmpdir(), 'oakestra-publish-'));

// publishedPackageDirs lists @oakestra/api before the SDK that depends on it.
for (const { dir, pkg } of packages) {
  const id = `${pkg.name}@${pkg.version}`;
  const distTag = snapshotId === undefined ? releaseTag(pkg.version) : 'canary';
  // pnpm, not npm, packs: it applies publishConfig and rewrites workspace: ranges. npm uploads
  // the tarball, since it is what speaks OIDC to npmjs. Every registry gets the same tarball.
  const before = new Set(readdirSync(tarballDir));
  execFileSync('pnpm', ['pack', '--pack-destination', tarballDir], { cwd: dir, stdio: 'inherit' });
  const tarball = readdirSync(tarballDir).find((file) => !before.has(file));
  if (!tarball) throw new Error(`pnpm pack wrote no tarball for ${id}`);

  for (const registry of registries) {
    if (isPublished(id, registry)) {
      console.log(`${id} is already on ${registry}, skipping`);
      continue;
    }
    // The registry makes the first version of a package "latest", whatever --tag says, so a
    // canary or beta published first would be what a plain install gets.
    if (distTag !== 'latest' && !hasAnyVersion(pkg.name, registry)) {
      throw new Error(
        `${pkg.name} has no release on ${registry} yet; publish a release before ${distTag} builds`,
      );
    }
    // Provenance is an npmjs feature; other registries reject the flag.
    const provenance = registry === NPMJS ? ['--provenance'] : [];
    execFileSync(
      'npm',
      [
        'publish',
        join(tarballDir, tarball),
        '--registry',
        registry,
        '--access',
        'public',
        '--tag',
        distTag,
        ...provenance,
      ],
      { stdio: 'inherit' },
    );
    console.log(`published ${id} to ${registry} (${distTag})`);
  }

  // Tagged even when every registry already had it, so a rerun after a failed push still tags.
  if (snapshotId === undefined && !hasRemoteTag(id)) {
    execFileSync('git', ['tag', id], { stdio: 'inherit' });
  }
}

/**
 * 0.1.0 -> 0.1.1-canary.42, which sorts after 0.1.0 and before any 0.1.1 release. In pre mode,
 * 0.3.0-beta.1 -> 0.3.0-beta.1.canary.42, which sorts between beta.1 and beta.2.
 */
function snapshotVersion(version: string, id: string): string {
  if (version.includes('-')) return `${version}.canary.${id}`;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`cannot derive a snapshot from version ${version}`);
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}-canary.${id}`;
}

/**
 * "latest" for a release. A prerelease goes under its name (0.3.0-beta.1 -> beta), which is the
 * tag Changesets pre mode was entered with, so it never becomes what a plain install gets.
 */
function releaseTag(version: string): string {
  if (!version.includes('-')) return 'latest';
  const name = /^\d+\.\d+\.\d+-([^.]+)/.exec(version)?.[1];
  if (name === undefined || !/^[a-z][a-z-]*$/.test(name) || name === 'latest') {
    throw new Error(`cannot derive a dist-tag from prerelease version ${version}`);
  }
  return name;
}

function isPublished(id: string, registry: string): boolean {
  try {
    // Prints nothing (exit 0) when the package exists but this version does not.
    const out = execFileSync('npm', ['view', id, 'version', '--registry', registry], {
      stdio: 'pipe',
    });
    return out.toString().trim() !== '';
  } catch (error) {
    // Anything but "not found" (network, auth) must stop the run instead of publishing blind.
    const stderr = String((error as { stderr?: Buffer }).stderr ?? '');
    if (stderr.includes('E404')) return false;
    throw error;
  }
}

function hasAnyVersion(name: string, registry: string): boolean {
  try {
    execFileSync('npm', ['view', name, 'version', '--registry', registry], { stdio: 'pipe' });
    return true;
  } catch (error) {
    const stderr = String((error as { stderr?: Buffer }).stderr ?? '');
    if (stderr.includes('E404')) return false;
    throw error;
  }
}

// Asks origin, because the CI checkout fetches no tags.
function hasRemoteTag(tag: string): boolean {
  return (
    execFileSync('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`])
      .toString()
      .trim() !== ''
  );
}
