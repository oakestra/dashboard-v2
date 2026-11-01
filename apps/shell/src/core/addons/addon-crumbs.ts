import { matchRoutes, type UIMatch } from 'react-router';
import { useStore } from 'zustand';

import type { Crumb } from '../router/route-handle';
import { addonLabel, type AddonEntry } from './addon-registry';
import { useAddonRegistry } from './addon-registry-context';
import { addonRouteObjects, type AddonRouteHandle } from './addon-routes';
import { addonBasePath } from './ui-addons';

/** Id of the `addons/:addonId/*` route, whose crumbs come from the addon instead of `handle`. */
export const ADDON_PAGE_ROUTE_ID = 'addon-page';

/**
 * Breadcrumbs of an addon page: the addon's label, then one crumb per matched addon route that
 * declares `crumb`.
 *
 * Addon routes are resolved by AddonRouteHost with useRoutes, so the data router's matches end at
 * `addons/:addonId/*`. The trail is derived here from the same route objects instead of being
 * published by the host, which keeps it right while the addon is loading, failed or missing (the
 * id stands in for the label) and needs no cleanup when the user navigates away.
 */
export function useAddonCrumbs(match: UIMatch | undefined): Crumb[] {
  const addonId = match?.params.addonId;
  const entry = useStore(useAddonRegistry(), (state) =>
    addonId ? state.entries[addonId] : undefined,
  );
  return match && addonId ? addonCrumbs(addonId, match.pathname, entry) : [];
}

export function addonCrumbs(
  addonId: string,
  pathname: string,
  entry: AddonEntry | undefined,
): Crumb[] {
  const base = addonBasePath(addonId);
  const definition = entry?.state === 'loaded' ? entry.definition : undefined;
  const crumbs: Crumb[] = [
    { id: `addon:${addonId}`, label: entry ? addonLabel(entry) : addonId, to: base },
  ];
  // react-router matches paths case-insensitively, so `/Addons/example/about` renders the page too.
  if (!definition?.routes || !pathname.toLowerCase().startsWith(base.toLowerCase())) return crumbs;

  const rest = pathname.slice(base.length) || '/';
  const matches = matchRoutes(addonRouteObjects(definition.routes), rest);
  matches?.forEach((match, index) => {
    const label = (match.route.handle as AddonRouteHandle | undefined)?.crumb;
    if (!label) return;
    const to = match.pathname === '/' ? base : `${base}${match.pathname}`;
    crumbs.push({ id: `addon:${addonId}:${index}`, label, to });
  });
  return crumbs;
}
