import { ServerIcon } from 'lucide-react';

import { requireRole } from '../../core/auth/guards';
import type { CoreModule } from '../../core/modules';
import type { RouteHandle } from '../../core/router/route-handle';
import { clusterCrumb, clusterCrumbLoader } from './crumbs';

// The one cluster list query: the overview, service and SLA pages read it too, so there is a
// single cache entry and poll for clusters.
export { clusterKeys, clustersQuery } from './api/queries';

export const infrastructureModule: CoreModule = {
  id: 'infrastructure',
  label: 'Infrastructure',
  routes: [
    {
      path: 'infrastructure',
      handle: { crumb: 'Infrastructure' } satisfies RouteHandle,
      loader: requireRole('Admin', 'Infrastructure_Provider'),
      children: [
        {
          index: true,
          lazy: () =>
            import('./pages/InfrastructurePage').then((m) => ({ Component: m.InfrastructurePage })),
        },
        {
          path: 'clusters/:clusterId',
          loader: clusterCrumbLoader,
          handle: { crumb: clusterCrumb } satisfies RouteHandle,
          lazy: () =>
            import('./pages/ClusterDetailPage').then((m) => ({ Component: m.ClusterDetailPage })),
        },
      ],
    },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'infrastructure',
        label: 'Infrastructure',
        path: '/infrastructure',
        icon: ServerIcon,
        group: 'management',
        order: 20,
        roles: ['Admin', 'Infrastructure_Provider'],
      },
    ],
  },
};
