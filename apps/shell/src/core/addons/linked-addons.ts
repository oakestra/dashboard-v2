import { SDK_VERSION, type AddonDefinition } from '@oakestra/dashboard-sdk';

import type { ContributionRegistry } from '../extensions/registry';
import { setEntry, type AddonRegistry } from './addon-registry';
import { parseAddonDefinition } from './definition';
import { errorMessage, resolveAddonContributions } from './loader';
import { addonSource, type ResolvedAddon } from './ui-addons';

/**
 * An addon package compiled into the shell (`modules/<name>`), listed in app/modules.ts. It is
 * the same definition a remote build would expose as `./addon`, only imported statically.
 */
export interface LinkedAddon {
  /** The package's default export. Its `id` is the addon name and the preset's module id. */
  definition: AddonDefinition;
  /** Top-level path its pages are served at, e.g. `/help`. `/addons/<name>` redirects there. */
  mount: string;
}

/**
 * Linked addons are built together with the shell, so they report the shell's SDK version as both
 * their version and their SDK range: there is nothing to be incompatible with.
 */
function resolveLinkedAddon({ definition, mount }: LinkedAddon): ResolvedAddon {
  return {
    name: definition.id,
    version: SDK_VERSION,
    sdk: SDK_VERSION,
    // Nothing to fetch. The loader never loads a linked entry, see AddonLoader.sync.
    entry: '',
    origin: 'linked',
    basePath: mount,
  };
}

/**
 * Validates and registers the linked addons, synchronously and before the first render, so their
 * nav items and pages exist from the start like those of core modules. They go through the same
 * validation as remote addons: an invalid definition becomes a `failed` entry with the reason,
 * never a crash of the whole shell.
 */
export function registerLinkedAddons(
  linked: readonly LinkedAddon[],
  registries: { addons: AddonRegistry; contributions: ContributionRegistry },
): void {
  for (const addon of linked) {
    const resolved = resolveLinkedAddon(addon);
    try {
      const definition = parseAddonDefinition(addon.definition, resolved.name);
      const source = addonSource(resolved);
      registries.contributions
        .getState()
        .register(source, resolveAddonContributions(definition, resolved.basePath));
      setEntry(registries.addons, { ...resolved, state: 'loaded', definition });
    } catch (error) {
      console.error(`[addons] linked addon "${resolved.name}" is invalid`, error);
      setEntry(registries.addons, { ...resolved, state: 'failed', error: errorMessage(error) });
    }
  }
}
