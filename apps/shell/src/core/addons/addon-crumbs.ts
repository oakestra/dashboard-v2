import { hasAnyRole, type CurrentUser } from '@oakestra/dashboard-sdk';
import { createElement, type ReactNode } from 'react';
import type { RouteObject, UIMatch } from 'react-router';
import { useStore } from 'zustand';

import type { Preset } from '../config/preset';
import { navItemKey } from '../extensions/registry';
import { usePreset } from '../config/preset-context';
import type { Crumb } from '../router/route-handle';
import { AddonCrumbLabel } from './AddonCrumbLabel';
import { addonLabel, type AddonEntry } from './addon-registry';
import { useAddonRegistry } from './addon-registry-context';
import { matchAddonRoutes, useSessionUser, type AddonRouteHandle } from './addon-routes';
import { addonBasePath } from './ui-addons';

/** Id of the `addons/:addonId/*` route, whose crumbs come from the addon instead of `handle`. */
export const ADDON_PAGE_ROUTE_ID = 'addon-page';

// Route ids must be unique, so every mounted addon gets its own id under this prefix.
const ADDON_MOUNT_ROUTE_ID_PREFIX = 'addon-mount:';

interface AddonMountHandle {
  addonBasePath: string;
}

/**
 * The route of a preset addon served at `mount` instead of `/addons/<name>`. Like the generic
 * addon page route, its crumbs and page width come from the addon (see isAddonPageMatch).
 */
export function addonMountRoute(addonId: string, mount: string, element: ReactNode): RouteObject {
  return {
    id: `${ADDON_MOUNT_ROUTE_ID_PREFIX}${addonId}`,
    path: `${mount.replace(/^\//, '')}/*`,
    handle: { addonBasePath: mount } satisfies AddonMountHandle,
    element,
  };
}

/**
 * Whether `match` is an addon page, at `/addons/:addonId/*` or at a mount. The layout expands
 * these into the addon's own crumbs and reads their width from the addon's routes.
 */
export function isAddonPageMatch(match: UIMatch): boolean {
  return match.id === ADDON_PAGE_ROUTE_ID || match.id.startsWith(ADDON_MOUNT_ROUTE_ID_PREFIX);
}

interface AddonPage {
  addonId: string;
  basePath: string;
}

function addonPageOf(match: UIMatch | undefined): AddonPage | undefined {
  if (!match) return undefined;
  if (match.id.startsWith(ADDON_MOUNT_ROUTE_ID_PREFIX)) {
    return {
      addonId: match.id.slice(ADDON_MOUNT_ROUTE_ID_PREFIX.length),
      basePath: (match.handle as AddonMountHandle).addonBasePath,
    };
  }
  const addonId = match.params.addonId;
  return addonId ? { addonId, basePath: addonBasePath(addonId) } : undefined;
}

/** The registry entry of the addon whose page `match` is, if it is one. */
function useAddonEntry(page: AddonPage | undefined): AddonEntry | undefined {
  return useStore(useAddonRegistry(), (state) => (page ? state.entries[page.addonId] : undefined));
}

/**
 * Breadcrumbs of an addon page: the addon's label, then one crumb per matched addon route that
 * declares `crumb`. See matchAddonRoutes for why they aren't read from the data router.
 */
export function useAddonCrumbs(match: UIMatch | undefined): Crumb[] {
  const page = addonPageOf(match);
  const entry = useAddonEntry(page);
  const user = useSessionUser();
  const { nav } = usePreset();
  if (!match || !page) return [];
  const rootLabel = entry ? navOverrideLabel(page.addonId, entry, nav.items) : undefined;
  return addonCrumbs(page.addonId, match.pathname, entry, page.basePath, user, rootLabel);
}

/**
 * The label a preset gave the addon's own nav item, the top-level one that links to the addon's
 * base path. The first crumb links to the same place, so a deployment that renames the item
 * would otherwise show the old name in the trail. Other items (pointing at sub-pages) say nothing
 * about the addon as a whole and are ignored.
 */
export function navOverrideLabel(
  addonId: string,
  entry: AddonEntry,
  overrides: Preset['nav']['items'],
): string | undefined {
  if (entry.state !== 'loaded') return undefined;
  const items = entry.definition.contributions?.['nav.items'] ?? [];
  const root = items.find((item) => item.path.replace(/^\.?\/?/, '') === '');
  return root ? overrides[navItemKey({ kind: 'addon', id: addonId }, root.id)]?.label : undefined;
}

export function addonCrumbs(
  addonId: string,
  pathname: string,
  entry: AddonEntry | undefined,
  base = addonBasePath(addonId),
  user: CurrentUser | null = null,
  rootLabel?: string,
): Crumb[] {
  const crumbs: Crumb[] = [
    { id: `addon:${addonId}`, label: rootLabel ?? (entry ? addonLabel(entry) : addonId), to: base },
  ];
  for (const [index, match] of matchAddonRoutes(base, pathname, entry).entries()) {
    const handle = match.route.handle as AddonRouteHandle | undefined;
    const crumb = handle?.crumb;
    const denied = !hasAnyRole(user, handle?.roles);
    if (denied && typeof crumb !== 'string') break;
    if (!crumb || !entry) continue;
    // From a denied route on the host renders Forbidden. Its own label stays (a string is just
    // text, and the trail then shows where the user tried to go), but a crumb component may fetch
    // data the user is not allowed to read, so none runs from here on. A parent's roles guard
    // its children, hence the first denial ends the trail.
    const to = match.pathname === '/' ? base : `${base}${match.pathname}`;
    const label =
      typeof crumb === 'string'
        ? crumb
        : // Keyed by path, so a crumb that failed for one page gets a fresh boundary on the next.
          createElement(AddonCrumbLabel, {
            key: match.pathname,
            crumb,
            params: match.params,
            entry,
            fallback: lastSegment(match.pathname),
          });
    crumbs.push({ id: `addon:${addonId}:${index}`, label, to });
    if (denied) break;
  }
  return crumbs;
}

function lastSegment(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean).at(-1) ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The `fullWidth` of every matched route of an addon page, outermost first (see pageFullWidth). */
export function useAddonFullWidth(match: UIMatch | undefined): (boolean | undefined)[] {
  const page = addonPageOf(match);
  const entry = useAddonEntry(page);
  if (!match || !page) return [];
  return matchAddonRoutes(page.basePath, match.pathname, entry).map(
    (route) => (route.route.handle as AddonRouteHandle | undefined)?.fullWidth,
  );
}
