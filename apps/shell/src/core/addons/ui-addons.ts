import semver from 'semver';
import { z } from 'zod';

import type { ContributionSource } from '../extensions/registry';

/** Addon names double as container names (`addonui-<name>`) and nginx path segments. */
export const ADDON_NAME_PATTERN = /^[a-z0-9-]+$/;

export const uiAddonSchema = z.object({
  name: z.string().regex(ADDON_NAME_PATTERN),
  version: z.string().min(1),
  sdk: z.string().refine((range) => semver.validRange(range) !== null, 'not a valid semver range'),
});

export const uiAddonsQueryKey = ['ui-addons'] as const;

/** One entry of `GET /ui-addons`: an active addon that ships a UI. */
export type UiAddon = z.infer<typeof uiAddonSchema>;

/**
 * Where an addon came from: the addons-manager (`/ui-addons`), the deployment preset, a dev
 * override pointing at a local dev server, or a package compiled into the shell (`linked`).
 */
export type AddonOrigin = 'manager' | 'preset' | 'dev' | 'linked';

/** An addon to load: a /ui-addons entry plus where it is loaded from and served at. */
export interface ResolvedAddon extends UiAddon {
  /** Manifest URL the remote was (or is being) loaded from. Empty for linked addons. */
  entry: string;
  origin: AddonOrigin;
  /** Where the addon's pages live: `/addons/<name>`, or the preset's `mount`. */
  basePath: string;
}

/** The addons manager is missing (addons disabled) or down. Not an error worth showing users. */
export class UiAddonsUnavailableError extends Error {
  override name = 'UiAddonsUnavailableError';
}

export async function fetchUiAddons(url: string, signal?: AbortSignal): Promise<UiAddon[]> {
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new UiAddonsUnavailableError(`GET ${url} failed: ${String(error)}`, { cause: error });
  }
  if (!response.ok) {
    throw new UiAddonsUnavailableError(`GET ${url} returned HTTP ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new UiAddonsUnavailableError(`GET ${url} did not return JSON`, { cause: error });
  }
  return parseUiAddons(body);
}

/**
 * Validates the list entry by entry, so one malformed addon record cannot hide all the others.
 */
export function parseUiAddons(body: unknown): UiAddon[] {
  if (!Array.isArray(body)) {
    throw new UiAddonsUnavailableError('/ui-addons did not return an array');
  }
  const addons = new Map<string, UiAddon>();
  for (const candidate of body) {
    const result = uiAddonSchema.safeParse(candidate);
    if (!result.success) {
      console.warn('[addons] ignoring invalid /ui-addons entry', candidate, result.error.issues);
      continue;
    }
    if (addons.has(result.data.name)) {
      console.warn(`[addons] ignoring duplicate /ui-addons entry for "${result.data.name}"`);
      continue;
    }
    addons.set(result.data.name, result.data);
  }
  return [...addons.values()];
}

export function addonEntryUrl(name: string, origin = window.location.origin): string {
  // Absolute on purpose: remotes are built with publicPath "auto", which the federation runtime can
  // only resolve against an absolute manifest URL.
  return new URL(`/addon-assets/${name}/mf-manifest.json`, origin).href;
}

export function addonBasePath(name: string): string {
  return `/addons/${name}`;
}

/** The source an addon's contributions and pages are registered and isolated under. */
export function addonSource(
  addon: Pick<ResolvedAddon, 'name' | 'version' | 'basePath'>,
): Extract<ContributionSource, { kind: 'addon' }> {
  return {
    kind: 'addon',
    id: addon.name,
    label: `addon "${addon.name}"`,
    addon: { addonId: addon.name, version: addon.version, basePath: addon.basePath },
  };
}
