import { createBrowserRouter, type RouteObject } from 'react-router';

import { AddonRouteHost } from '../core/addons/AddonRouteHost';
import { requireAuth } from '../core/auth/guards';
import type { CoreModule } from '../core/modules';
import { createRouterContext, type AppRouterContext } from '../core/router/app-context';
import type { RouteHandle } from '../core/router/route-handle';
import { NotFoundPage } from './errors/NotFoundPage';
import { PageSkeleton } from './errors/PageSkeleton';
import { RouteErrorPage } from './errors/RouteErrorPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';

export function createAppRoutes(modules: readonly CoreModule[]): RouteObject[] {
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
            ...modules.flatMap((module) => module.routes),
            {
              path: 'addons/:addonId/*',
              Component: AddonRouteHost,
              handle: { crumb: (match) => match.params.addonId ?? 'Addon' } satisfies RouteHandle,
            },
            { path: '*', Component: NotFoundPage },
          ],
        },
      ],
    },
  ];
}

export function createAppRouter(modules: readonly CoreModule[], context: AppRouterContext) {
  return createBrowserRouter(createAppRoutes(modules), {
    getContext: createRouterContext(context),
  });
}
