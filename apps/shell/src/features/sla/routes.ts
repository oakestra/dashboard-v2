import type { RouteObject } from 'react-router';

import type { RouteHandle } from '../../core/router/route-handle';

/** Relative to `applications/:appId`; nested there by the applications module. */
export const newServiceRoutes: RouteObject[] = [
  {
    path: 'services/new',
    handle: { crumb: 'New service' } satisfies RouteHandle,
    lazy: () => import('./pages/NewServicePage').then((m) => ({ Component: m.NewServicePage })),
  },
];

/** Relative to `applications/:appId/services/:serviceId`, so the service stays in the breadcrumbs. */
export const duplicateServiceRoutes: RouteObject[] = [
  {
    path: 'duplicate',
    handle: { crumb: 'Duplicate' } satisfies RouteHandle,
    lazy: () =>
      import('./pages/DuplicateServicePage').then((m) => ({ Component: m.DuplicateServicePage })),
  },
];
