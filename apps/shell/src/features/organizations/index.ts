import { BuildingIcon } from 'lucide-react';

import { requireRole } from '../../core/auth/guards';
import type { CoreModule } from '../../core/modules';
import type { RouteHandle } from '../../core/router/route-handle';
import { organizationCrumb, organizationCrumbLoader } from './crumbs';

export { organizationKeys } from './api/queries';

export const organizationsModule: CoreModule = {
  id: 'organizations',
  label: 'Organizations',
  routes: [
    {
      path: 'organizations',
      loader: requireRole('Admin'),
      handle: { crumb: 'Organizations' } satisfies RouteHandle,
      children: [
        {
          index: true,
          lazy: () =>
            import('./pages/OrganizationsPage').then((m) => ({ Component: m.OrganizationsPage })),
        },
        {
          path: ':orgId',
          loader: organizationCrumbLoader,
          handle: { crumb: organizationCrumb } satisfies RouteHandle,
          lazy: () =>
            import('./pages/OrganizationDetailPage').then((m) => ({
              Component: m.OrganizationDetailPage,
            })),
        },
      ],
    },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'organizations',
        label: 'Organizations',
        path: '/organizations',
        icon: BuildingIcon,
        group: 'management',
        order: 20,
        roles: ['Admin'],
      },
    ],
  },
};
