import { defineAddon } from '@oakestra/dashboard-sdk';
import { ServerIcon } from 'lucide-react';
import { lazy } from 'react';

import { ClusterCrumb } from './components/ClusterCrumb';
import { INFRASTRUCTURE_ROLES } from './roles';

export { INFRASTRUCTURE_ROLES };

const InfrastructurePage = lazy(() =>
  import('./pages/InfrastructurePage').then((m) => ({ default: m.InfrastructurePage })),
);
const ClusterDetailPage = lazy(() =>
  import('./pages/ClusterDetailPage').then((m) => ({ default: m.ClusterDetailPage })),
);
const ClustersTile = lazy(() =>
  import('./components/ClustersTile').then((m) => ({ default: m.ClustersTile })),
);

export default defineAddon({
  id: 'infrastructure',
  // Also the first breadcrumb, so the list route needs no crumb of its own.
  label: 'Infrastructure',
  routes: [
    {
      // A parent's roles guard its children, so one entry covers the list and the detail page.
      roles: INFRASTRUCTURE_ROLES,
      children: [
        { index: true, Component: InfrastructurePage },
        { path: 'clusters/:clusterId', crumb: ClusterCrumb, Component: ClusterDetailPage },
      ],
    },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'infrastructure',
        label: 'Infrastructure',
        path: '',
        icon: ServerIcon,
        group: 'management',
        // Management reads Users 10, Infrastructure 20, Organizations 30, Addons 40. Keep the orders
        // distinct: core modules and linked packages register separately, so a tie would sort by
        // registration order, not by intent.
        order: 20,
        roles: INFRASTRUCTURE_ROLES,
      },
    ],
    // No roles: everyone sees the tile, it only links for INFRASTRUCTURE_ROLES. After the
    // applications package's tiles (100 to 300), with room left on both sides.
    'home.widgets': [
      { id: 'clusters', title: 'Clusters', size: 'stat', order: 400, component: ClustersTile },
    ],
  },
});
