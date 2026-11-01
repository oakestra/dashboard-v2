import type { RouteObject } from 'react-router';

import type { RouteHandle } from '../../core/router/route-handle';
import { serviceCrumb, serviceCrumbLoader } from './crumbs';

/**
 * Service and instance routes, relative to `applications/:appId`. They are exported as plain
 * route objects instead of being a module because react-router needs exactly one
 * `applications/:appId` object: the applications module owns that tree and nests these, so the
 * breadcrumbs read Applications > app > service. `extraChildren` lets other features add pages
 * below a service (the SLA module's duplicate form) without this feature knowing them.
 */
export function createServiceRoutes(extraChildren: RouteObject[] = []): RouteObject[] {
  return [
    {
      path: 'services/:serviceId',
      loader: serviceCrumbLoader,
      handle: { crumb: serviceCrumb } satisfies RouteHandle,
      children: [
        {
          index: true,
          lazy: () =>
            import('./pages/ServiceDetailPage').then((m) => ({ Component: m.ServiceDetailPage })),
        },
        {
          path: 'instances/:instanceNumber',
          handle: {
            crumb: (match) => `Instance ${match.params.instanceNumber ?? ''}`.trim(),
          } satisfies RouteHandle,
          lazy: () =>
            import('./pages/InstanceDetailPage').then((m) => ({
              Component: m.InstanceDetailPage,
            })),
        },
        ...extraChildren,
      ],
    },
  ];
}
