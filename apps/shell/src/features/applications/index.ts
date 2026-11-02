import { BoxesIcon } from 'lucide-react';

import type { CoreModule } from '../../core/modules';
import type { RouteHandle } from '../../core/router/route-handle';
import { createServiceRoutes } from '../services';
import { duplicateServiceRoutes, newServiceRoutes } from '../sla';
import { applicationCrumb, applicationCrumbLoader } from './crumbs';

// Other features (services, overview, SLA form) share these instead of fetching under their own keys.
export { applicationKeys, applicationQuery, applicationsQuery, newestFirst } from './api/queries';
export { ApplicationFormDialog } from './components/ApplicationFormDialog';
export { applicationHealth, describeServiceCounts } from './health';
export type { ApplicationHealth } from './health';

/**
 * Owns the whole `applications/:appId` tree. React Router needs a single route object per path,
 * so the services and SLA features export route arrays that are nested here instead of declaring
 * their own `applications/:appId` (two objects for one path make the match depend on module
 * order).
 */
export const applicationsModule: CoreModule = {
  id: 'applications',
  label: 'Applications',
  routes: [
    {
      path: 'applications',
      handle: { crumb: 'Applications' } satisfies RouteHandle,
      children: [
        {
          index: true,
          lazy: () =>
            import('./pages/ApplicationsPage').then((m) => ({ Component: m.ApplicationsPage })),
        },
        {
          path: ':appId',
          loader: applicationCrumbLoader,
          handle: { crumb: applicationCrumb } satisfies RouteHandle,
          children: [
            {
              index: true,
              lazy: () =>
                import('./pages/ApplicationDetailPage').then((m) => ({
                  Component: m.ApplicationDetailPage,
                })),
            },
            ...newServiceRoutes,
            ...createServiceRoutes(duplicateServiceRoutes),
          ],
        },
      ],
    },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'applications',
        label: 'Applications',
        path: '/applications',
        icon: BoxesIcon,
        group: 'main',
        order: 10,
      },
    ],
  },
};
