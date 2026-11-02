import type { UIMatch } from 'react-router';
import { useStore } from 'zustand';

import type { Crumb } from '../router/route-handle';
import { addonLabel, type AddonEntry } from './addon-registry';
import { useAddonRegistry } from './addon-registry-context';
import { matchAddonRoutes, type AddonRouteHandle } from './addon-routes';
import { addonBasePath } from './ui-addons';

/** Id of the `addons/:addonId/*` route, whose crumbs come from the addon instead of `handle`. */
export const ADDON_PAGE_ROUTE_ID = 'addon-page';

/** The registry entry of the addon whose page `match` is, if it is one. */
function useAddonEntry(match: UIMatch | undefined): AddonEntry | undefined {
  const addonId = match?.params.addonId;
  return useStore(useAddonRegistry(), (state) => (addonId ? state.entries[addonId] : undefined));
}

/**
 * Breadcrumbs of an addon page: the addon's label, then one crumb per matched addon route that
 * declares `crumb`. See matchAddonRoutes for why they aren't read from the data router.
 */
export function useAddonCrumbs(match: UIMatch | undefined): Crumb[] {
  const entry = useAddonEntry(match);
  const addonId = match?.params.addonId;
  return match && addonId ? addonCrumbs(addonId, match.pathname, entry) : [];
}

export function addonCrumbs(
  addonId: string,
  pathname: string,
  entry: AddonEntry | undefined,
): Crumb[] {
  const base = addonBasePath(addonId);
  const crumbs: Crumb[] = [
    { id: `addon:${addonId}`, label: entry ? addonLabel(entry) : addonId, to: base },
  ];
  matchAddonRoutes(addonId, pathname, entry).forEach((match, index) => {
    const label = (match.route.handle as AddonRouteHandle | undefined)?.crumb;
    if (!label) return;
    const to = match.pathname === '/' ? base : `${base}${match.pathname}`;
    crumbs.push({ id: `addon:${addonId}:${index}`, label, to });
  });
  return crumbs;
}

/** The `fullWidth` of every matched route of an addon page, outermost first (see pageFullWidth). */
export function useAddonFullWidth(match: UIMatch | undefined): (boolean | undefined)[] {
  const entry = useAddonEntry(match);
  const addonId = match?.params.addonId;
  if (!match || !addonId) return [];
  return matchAddonRoutes(addonId, match.pathname, entry).map(
    (route) => (route.route.handle as AddonRouteHandle | undefined)?.fullWidth,
  );
}
