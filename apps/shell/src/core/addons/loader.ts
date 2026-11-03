import type { AddonDefinition, Contributions, NavItem } from '@oakestra/dashboard-sdk';

import type { ContributionRegistry } from '../extensions/registry';
import { sourceKey } from '../extensions/registry';
import { deleteEntries, setEntry, type AddonEntry, type AddonRegistry } from './addon-registry';
import { parseAddonDefinition } from './definition';
import type { AddonModuleRuntime } from './federation-runtime';
import { checkSdkCompatibility } from './sdk-compat';
import { addonSource, type ResolvedAddon, type UiAddon } from './ui-addons';

export interface AddonLoaderDeps {
  sdkVersion: string;
  runtime: AddonModuleRuntime;
  addons: AddonRegistry;
  contributions: ContributionRegistry;
  /** Called once per new version of an addon that is already running in this page. */
  onUpgradeAvailable: (current: AddonEntry, next: UiAddon) => void;
}

export interface AddonLoader {
  /** Reconciles the registry with the latest /ui-addons list. Resolves when all loads settle. */
  sync(addons: readonly ResolvedAddon[]): Promise<void>;
}

export function createAddonLoader(deps: AddonLoaderDeps): AddonLoader {
  const { addons, contributions, runtime } = deps;

  // Each load gets a token. A result is only applied if its token is still current, so a load
  // that finishes after the addon was removed (or reloaded) cannot resurrect stale state.
  const currentLoads = new Map<string, symbol>();

  const unregisterContributions = (name: string) =>
    contributions.getState().unregister(sourceKey({ kind: 'addon', id: name }));

  async function load(addon: ResolvedAddon, previous: AddonEntry | undefined): Promise<void> {
    const token = Symbol(addon.name);
    currentLoads.set(addon.name, token);
    // A retry keeps showing the last error until it either succeeds or fails again, so a page
    // that shows the failure does not flicker to a loading state on every poll.
    if (previous?.state !== 'failed' || previous.version !== addon.version) {
      setEntry(addons, { ...addon, state: 'loading' });
    }

    try {
      runtime.register(addon.name, addon.entry);
      const module = await runtime.load(addon.name);
      const definition = parseAddonDefinition(module, addon.name);
      if (currentLoads.get(addon.name) !== token) return;

      const source = addonSource(addon);
      contributions
        .getState()
        .register(source, resolveAddonContributions(definition, source.addon.basePath));
      setEntry(addons, { ...addon, state: 'loaded', definition });
    } catch (error) {
      if (currentLoads.get(addon.name) !== token) return;
      console.error(`[addons] failed to load "${addon.name}"`, error);
      const failed: FailedEntry = { ...addon, state: 'failed', error: errorMessage(error) };
      // Failed addons are retried on every poll. Writing an identical entry would still hand out
      // a new `entries` object each time and re-render everything that selects it.
      if (!sameFailure(addons.getState().entries[addon.name], failed)) setEntry(addons, failed);
    } finally {
      if (currentLoads.get(addon.name) === token) currentLoads.delete(addon.name);
    }
  }

  function sync(list: readonly ResolvedAddon[]): Promise<void> {
    const pending: Promise<void>[] = [];
    const listed = new Set<string>();

    for (const addon of list) {
      listed.add(addon.name);
      const existing = addons.getState().entries[addon.name];

      if (currentLoads.has(addon.name)) continue;

      // Compiled into the shell and registered at startup (registerLinkedAddons). A preset that
      // wants another build under that name replaces the linked addon before it is registered, so
      // a list entry here is the manager or a dev override, and neither can swap shell code.
      if (existing?.origin === 'linked') {
        warnShadowedByLinked(addon.name);
        continue;
      }

      if (existing?.state === 'loaded') {
        // A loaded federation module cannot be swapped out of a running React tree, so a new
        // version only takes effect after a reload. Ask once per version. A dev override has no
        // version of its own (the early sync before /ui-addons answers uses a placeholder), and
        // its server always serves the latest build, so it never has an upgrade to offer.
        if (
          addon.origin !== 'dev' &&
          existing.version !== addon.version &&
          existing.availableVersion !== addon.version
        ) {
          setEntry(addons, { ...existing, availableVersion: addon.version });
          deps.onUpgradeAvailable(existing, addon);
        }
        continue;
      }

      if (
        existing?.state === 'incompatible' &&
        existing.version === addon.version &&
        existing.sdk === addon.sdk
      ) {
        continue;
      }

      const compatibility = checkSdkCompatibility(deps.sdkVersion, addon.sdk);
      if (!compatibility.compatible) {
        setEntry(addons, { ...addon, state: 'incompatible', error: compatibility.reason });
        continue;
      }

      // New addon, or a failed one: (re)load. Failed addons are retried on every sync because
      // "active" in the addons manager only means the container runs, not that it serves yet.
      pending.push(load(addon, existing));
    }

    removeMissing(listed);
    return Promise.all(pending).then(() => undefined);
  }

  function removeMissing(listed: ReadonlySet<string>): void {
    // Linked addons are never in the list: they exist for the whole page load.
    const missing = Object.entries(addons.getState().entries)
      .filter(([name, entry]) => !listed.has(name) && entry.origin !== 'linked')
      .map(([name]) => name);
    for (const name of missing) {
      currentLoads.delete(name);
      unregisterContributions(name);
    }
    deleteEntries(addons, missing);
  }

  return { sync };
}

const reportedShadowed = new Set<string>();

/** Once per name and page load: the list is synced on every poll. */
function warnShadowedByLinked(name: string): void {
  if (reportedShadowed.has(name)) return;
  reportedShadowed.add(name);
  console.warn(`[addons] ignoring "${name}" from /ui-addons or a dev override: it is linked`);
}

type FailedEntry = Extract<AddonEntry, { state: 'failed' }>;

function sameFailure(current: AddonEntry | undefined, next: FailedEntry): boolean {
  return (
    current?.state === 'failed' &&
    current.version === next.version &&
    current.sdk === next.sdk &&
    current.entry === next.entry &&
    current.error === next.error
  );
}

/** Addon nav paths are written relative to the addon; the registry stores absolute paths. */
export function resolveAddonContributions(
  definition: AddonDefinition,
  basePath: string,
): Contributions {
  const contributions = definition.contributions ?? {};
  const navItems = contributions['nav.items'];
  if (!navItems) return contributions;
  return {
    ...contributions,
    'nav.items': navItems.map((item): NavItem => ({
      ...item,
      group: item.group ?? 'addons',
      path: joinPath(basePath, item.path),
      children: item.children?.map((child) => ({ ...child, path: joinPath(basePath, child.path) })),
    })),
  };
}

function joinPath(base: string, relative: string): string {
  const trimmed = relative.replace(/^\.?\/?/, '');
  return trimmed ? `${base}/${trimmed}` : base;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
