import { hasAnyRole, type AddonRoute, type CurrentUser } from '@oakestra/dashboard-sdk';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { Outlet, type RouteObject } from 'react-router';

import { AuthSessionContext } from '../auth/auth-context';

/** What an addon route carries into the react-router tree, for the host and the breadcrumbs. */
export interface AddonRouteHandle {
  crumb?: string;
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

function toRouteObject(route: AddonRoute): RouteObject {
  const handle: AddonRouteHandle = { crumb: route.crumb };
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
