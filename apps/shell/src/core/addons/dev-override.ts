import {
  ADDON_NAME_PATTERN,
  addonBasePath,
  addonEntryUrl,
  isHttpUrl,
  type ResolvedAddon,
  type UiAddon,
} from './ui-addons';

/** Addon name -> manifest URL of a local dev server. */
export type AddonOverrides = Readonly<Record<string, string>>;

const STORAGE_KEY = 'oakestra.addon-overrides';
const QUERY_PARAM = 'addon-override';

/**
 * Dev-only: lets a developer point an addon at a local dev server, e.g.
 * `?addon-override=example=http://localhost:5174/mf-manifest.json`. An empty URL
 * (`?addon-override=example=`) removes that override again.
 *
 * Production builds must never honour this, since a crafted link could otherwise load arbitrary
 * code into a logged-in session. The `import.meta.env.DEV` check is replaced with `false` at build
 * time, so everything behind it is dropped from the bundle (asserted by scripts/assert-prod-bundle).
 */
export function getDevOverrides(): AddonOverrides {
  if (!import.meta.env.DEV) return {};
  return readOverrides(window.location.search, window.localStorage);
}

export function readOverrides(search: string, storage: Storage): AddonOverrides {
  const overrides: Record<string, string> = { ...readStored(storage) };
  const params = new URLSearchParams(search).getAll(QUERY_PARAM);
  for (const param of params) {
    const separator = param.indexOf('=');
    if (separator < 0) continue;
    const name = param.slice(0, separator);
    const url = param.slice(separator + 1);
    if (!ADDON_NAME_PATTERN.test(name)) continue;
    if (url === '') {
      delete overrides[name];
    } else if (isHttpUrl(url)) {
      overrides[name] = url;
    }
  }
  if (params.length > 0) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      // Private mode or full storage: the override still applies to this page load.
    }
  }
  return overrides;
}

function readStored(storage: Storage): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          ADDON_NAME_PATTERN.test(entry[0]) && typeof entry[1] === 'string' && isHttpUrl(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

export interface ResolveAddonsOptions {
  /** Addons of the deployment preset (see resolvePresetAddons). */
  preset?: readonly ResolvedAddon[];
  entryUrl?: (name: string) => string;
}

// A manager entry shadowed by the preset is reported once per page load, not on every poll.
const reportedShadowed = new Set<string>();

/**
 * Merges the /ui-addons list with the preset's addons and the dev overrides. Precedence is dev
 * override > preset > /ui-addons: the preset pins the addons a deployment ships, so the manager
 * cannot swap them for another build, while a developer can still point any of them at a local dev
 * server. Overrides for addons nobody lists are added, so a brand new addon can be developed
 * without installing it first.
 */
export function resolveAddons(
  addons: readonly UiAddon[],
  overrides: AddonOverrides,
  { preset = [], entryUrl = addonEntryUrl }: ResolveAddonsOptions = {},
): ResolvedAddon[] {
  const resolved = new Map<string, ResolvedAddon>();
  for (const addon of addons) {
    if (preset.some((pinned) => pinned.name === addon.name)) {
      if (!reportedShadowed.has(addon.name)) {
        reportedShadowed.add(addon.name);
        console.warn(`[addons] ignoring /ui-addons entry "${addon.name}": the preset pins it`);
      }
      continue;
    }
    resolved.set(addon.name, {
      ...addon,
      entry: entryUrl(addon.name),
      origin: 'manager',
      basePath: addonBasePath(addon.name),
    });
  }
  for (const addon of preset) resolved.set(addon.name, addon);
  for (const [name, entry] of Object.entries(overrides)) {
    const listed = resolved.get(name);
    resolved.set(
      name,
      listed
        ? // Keeps the base path, so an overridden preset addon stays at its mount.
          { ...listed, entry, origin: 'dev' }
        : {
            name,
            version: '0.0.0-dev',
            sdk: '*',
            entry,
            origin: 'dev',
            basePath: addonBasePath(name),
          },
    );
  }
  return [...resolved.values()];
}
