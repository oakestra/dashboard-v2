import type { Preset } from '../config/preset';
import { addonBasePath, type ResolvedAddon } from './ui-addons';

/** The addons a deployment preset ships, ready for the loader. */
export function resolvePresetAddons(
  preset: Pick<Preset, 'addons'>,
  origin = window.location.origin,
): ResolvedAddon[] {
  return preset.addons.map(({ mount, ...addon }) => ({
    ...addon,
    // Absolute like addonEntryUrl: remotes are built with publicPath "auto", which the federation
    // runtime can only resolve against an absolute manifest URL.
    entry: new URL(addon.entry, origin).href,
    origin: 'preset',
    basePath: mount ?? addonBasePath(addon.name),
  }));
}
