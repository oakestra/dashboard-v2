import { hasAnyRole, type AddonRoute, type CurrentUser } from '@oakestra/dashboard-sdk';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { matchRoutes, Outlet, type RouteMatch, type RouteObject } from 'react-router';

import { AuthSessionContext } from '../auth/auth-context';
import type { AddonEntry } from './addon-registry';
import { addonBasePath } from './ui-addons';

/** What an addon route carries into the react-router tree, for the host and the layout. */
export interface AddonRouteHandle {
  crumb?: string;
  fullWidth?: boolean;
}

/** The page shown for a route the user lacks the roles for. Provided by the app. */
export const AddonForbiddenContext = createContext<ReactNode>(null);

// Definitions are immutable once validated, so the route tree is built once per definition and
// shared by the host (rendering) and the breadcrumbs (matching), which therefore always agree.
const cache = new WeakMap<readonly AddonRoute[], RouteObject[]>();

export function addonRouteObjects(routes: readonly AddonRoute[]): RouteObject[] {
  let objects = cache.get(routes);
  if (!objects) {
    objects = routes.map(toRouteObject);
    cache.set(routes, objects);
  }
  return objects;
}

/**
 * The addon routes that `pathname` matches, outermost first. Empty while the addon isn't loaded
 * and for paths outside its base path or matching none of its routes.
 *
 * AddonRouteHost resolves addon routes with useRoutes, so the data router's matches end at
 * `addons/:addonId/*`. Whatever the layout needs from them (breadcrumbs, page width) is derived
 * from the same route objects here instead of being published by the host. That keeps it right
 * while the addon is loading, failed or missing, and needs no cleanup on navigation.
 */
export function matchAddonRoutes(
  addonId: string,
  pathname: string,
  entry: AddonEntry | undefined,
): RouteMatch[] {
  const base = addonBasePath(addonId);
  const definition = entry?.state === 'loaded' ? entry.definition : undefined;
  // react-router matches paths case-insensitively, so `/Addons/example/about` renders the page too.
  if (!definition?.routes || !pathname.toLowerCase().startsWith(base.toLowerCase())) return [];
  return (
    matchRoutes(addonRouteObjects(definition.routes), pathname.slice(base.length) || '/') ?? []
  );
}

function toRouteObject(route: AddonRoute): RouteObject {
  const handle: AddonRouteHandle = { crumb: route.crumb, fullWidth: route.fullWidth };
  // A route without a component renders its children, like in react-router. The gate wraps that
  // outlet too, which is how a parent's roles also guard every child route.
  const content = route.Component ? <route.Component /> : <Outlet />;
  const element =
    route.roles && route.roles.length > 0 ? (
      <RoleGate roles={route.roles}>{content}</RoleGate>
    ) : (
      content
    );
  if (route.index) return { index: true, element, handle };
  return {
    ...(route.path !== undefined ? { path: route.path } : {}),
    element,
    handle,
    ...(route.children ? { children: route.children.map(toRouteObject) } : {}),
  };
}

function RoleGate({ roles, children }: { roles: readonly string[]; children: ReactNode }) {
  const forbidden = useContext(AddonForbiddenContext);
  return hasAnyRole(useSessionUser(), roles) ? children : forbidden;
}

const noSubscription = () => () => {};

/**
 * Reads the user straight from the session store, so the host also renders without an auth
 * provider (and without the SDK's HostContext, which only addon UI needs).
 */
export function useSessionUser(): CurrentUser | null {
  const session = useContext(AuthSessionContext);
  return useSyncExternalStore(
    session ? session.store.subscribe : noSubscription,
    () => session?.store.getState().user ?? null,
  );
}
