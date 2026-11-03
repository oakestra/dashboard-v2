import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { ADDON_PAGE_ROUTE_ID, addonMountRoute } from '../core/addons/addon-crumbs';
import { AddonRouteHost } from '../core/addons/AddonRouteHost';
import type { LinkedAddon } from '../core/addons/linked-addons';
import { FORBIDDEN_MESSAGE, requireAuth } from '../core/auth/guards';
import { DEFAULT_PRESET, type Preset } from '../core/config/preset';
import type { CoreModule } from '../core/modules';
import { createRouterContext, type AppRouterContext } from '../core/router/app-context';
import type { RouteHandle } from '../core/router/route-handle';
import { NotFoundPage } from './errors/NotFoundPage';
import { PageSkeleton } from './errors/PageSkeleton';
import { ForbiddenPage, RouteErrorPage } from './errors/RouteErrorPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';

/** Whether one of these top-level routes renders the start page `/` (normally `overview`). */
export function ownsIndexRoute(routes: readonly RouteObject[]): boolean {
  return routes.some((route) => route.index || route.path === '' || route.path === '/');
}

/** The parts of the preset that shape the route tree. */
export type RoutePreset = Pick<Preset, 'home' | 'addons'>;

/** Every addon served at its own top-level path: the linked ones, then preset addons with a mount. */
export function addonMounts(
  linked: readonly LinkedAddon[],
  addons: RoutePreset['addons'],
): { name: string; mount: string }[] {
  return [
    ...linked.map((addon) => ({ name: addon.definition.id, mount: addon.mount })),
    ...addons.flatMap((addon) => (addon.mount ? [{ name: addon.name, mount: addon.mount }] : [])),
  ];
}

/**
 * The route tree for the enabled modules and linked addons. Run the preset through applyPreset
 * first: it guarantees that mounts do not overlap module routes or each other and that `home` is
 * set when no module owns `/`.
 */
export function createAppRoutes(
  modules: readonly CoreModule[],
  preset: RoutePreset = DEFAULT_PRESET,
  linked: readonly LinkedAddon[] = [],
): RouteObject[] {
  const forbidden = <ForbiddenPage message={FORBIDDEN_MESSAGE} />;
  const mounts = addonMounts(linked, preset.addons);
  const moduleRoutes = modules.flatMap((module) => module.routes);
  const ownsIndex = ownsIndexRoute(moduleRoutes);
  return [
    {
      id: 'public',
      Component: AuthLayout,
      ErrorBoundary: RouteErrorPage,
      HydrateFallback: PageSkeleton,
      children: modules.flatMap((module) => module.publicRoutes ?? []),
    },
    {
      id: 'app',
      path: '/',
      Component: AppLayout,
      loader: requireAuth,
      // Errors of the layout itself (or of requireAuth) replace the whole page.
      ErrorBoundary: RouteErrorPage,
      // Shown while the session is restored and the first lazy route module loads.
      HydrateFallback: PageSkeleton,
      handle: { crumb: 'Home' } satisfies RouteHandle,
      children: [
        {
          // Page errors (including 403 from requireRole) render inside the layout, so the
          // navigation stays usable.
          ErrorBoundary: RouteErrorPage,
          children: [
            ...moduleRoutes,
            ...(!ownsIndex && preset.home
              ? [{ index: true, element: <Navigate to={preset.home} replace /> }]
              : []),
            ...mounts.map(({ name, mount }) =>
              addonMountRoute(name, mount, <AddonRouteHost addonId={name} forbidden={forbidden} />),
            ),
            {
              // Breadcrumbs expand this route into the addon's trail (useAddonCrumbs).
              id: ADDON_PAGE_ROUTE_ID,
              path: 'addons/:addonId/*',
              element: <AddonRouteHost forbidden={forbidden} />,
            },
            { path: '*', Component: NotFoundPage },
          ],
        },
      ],
    },
  ];
}

export function createAppRouter(
  modules: readonly CoreModule[],
  preset: RoutePreset,
  linked: readonly LinkedAddon[],
  context: AppRouterContext,
) {
  return createBrowserRouter(createAppRoutes(modules, preset, linked), {
    getContext: createRouterContext(context),
  });
}
