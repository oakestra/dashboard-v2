import { ADDON_NAME_PATTERN, addonEntryUrl, type ResolvedAddon, type UiAddon } from './ui-addons';

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

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Resolves manifest URLs for the /ui-addons list. Overridden addons point at the dev server, and
 * overrides for addons the backend does not know yet are added, so a brand new addon can be
 * developed without installing it first.
 */
export function resolveAddons(
  addons: readonly UiAddon[],
  overrides: AddonOverrides,
  entryUrl: (name: string) => string = addonEntryUrl,
): ResolvedAddon[] {
  const resolved = addons.map((addon) => ({
    ...addon,
    entry: overrides[addon.name] ?? entryUrl(addon.name),
  }));
  for (const [name, entry] of Object.entries(overrides)) {
    if (!addons.some((addon) => addon.name === name)) {
      resolved.push({ name, version: '0.0.0-dev', sdk: '*', entry });
    }
  }
  return resolved;
}
