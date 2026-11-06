import { defineAddon } from '@oakestra/dashboard-sdk';
import { BoxesIcon, PlusIcon } from 'lucide-react';
import { lazy } from 'react';

import { ApplicationCrumb, InstanceCrumb, ServiceCrumb } from './crumbs';

const ApplicationsPage = lazy(() =>
  import('./applications/pages/ApplicationsPage').then((m) => ({ default: m.ApplicationsPage })),
);
const ApplicationDetailPage = lazy(() =>
  import('./applications/pages/ApplicationDetailPage').then((m) => ({
    default: m.ApplicationDetailPage,
  })),
);
const NewServicePage = lazy(() =>
  import('./sla/pages/NewServicePage').then((m) => ({ default: m.NewServicePage })),
);
const ServiceDetailPage = lazy(() =>
  import('./services/pages/ServiceDetailPage').then((m) => ({ default: m.ServiceDetailPage })),
);
const InstanceDetailPage = lazy(() =>
  import('./services/pages/InstanceDetailPage').then((m) => ({ default: m.InstanceDetailPage })),
);
const DuplicateServicePage = lazy(() =>
  import('./sla/pages/DuplicateServicePage').then((m) => ({ default: m.DuplicateServicePage })),
);
const ApplicationsTile = lazy(() =>
  import('./overview').then((m) => ({ default: m.ApplicationsTile })),
);
const ServicesTile = lazy(() => import('./overview').then((m) => ({ default: m.ServicesTile })));
const InstancesTile = lazy(() => import('./overview').then((m) => ({ default: m.InstancesTile })));
const NeedsAttention = lazy(() =>
  import('./overview').then((m) => ({ default: m.NeedsAttention })),
);
const RecentApplications = lazy(() =>
  import('./overview').then((m) => ({ default: m.RecentApplications })),
);

/**
 * Applications, their services and instances, and the SLA forms that create services. One package
 * because they are one domain: the pages nest below `:appId`, and every change to a service also
 * changes the application that lists its id.
 */
// Exported for the shell test that keeps this copy equal to the infrastructure package's roles.
export { INFRASTRUCTURE_ROLES } from './services/infrastructure-roles';

export default defineAddon({
  id: 'applications',
  // Also the first breadcrumb, so the list route needs no crumb of its own.
  label: 'Applications',
  routes: [
    { index: true, Component: ApplicationsPage },
    {
      path: ':appId',
      crumb: ApplicationCrumb,
      children: [
        { index: true, Component: ApplicationDetailPage },
        // Ranked above `services/:serviceId` because a static segment beats a dynamic one.
        { path: 'services/new', crumb: 'New service', Component: NewServicePage },
        {
          path: 'services/:serviceId',
          crumb: ServiceCrumb,
          children: [
            { index: true, Component: ServiceDetailPage },
            {
              path: 'instances/:instanceNumber',
              crumb: InstanceCrumb,
              Component: InstanceDetailPage,
            },
            // Below the service, so the breadcrumbs keep its name.
            { path: 'duplicate', crumb: 'Duplicate', Component: DuplicateServicePage },
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
        path: '',
        icon: BoxesIcon,
        group: 'main',
        order: 10,
      },
    ],
    'command.actions': [
      {
        id: 'new-application',
        label: 'New application',
        keywords: ['create', 'add'],
        // The form is a dialog on the list page, it has no route of its own.
        path: '?new=1',
        icon: PlusIcon,
        // Same as APPLICATION_ROLES of the fleet package.
        roles: ['Admin', 'Application_Provider'],
      },
    ],
    'command.sources': [
      {
        id: 'applications',
        label: 'Applications and services',
        // A function around the import: the search code is not needed before the palette is used.
        search: (query, ctx) =>
          import('./search').then(({ searchApplications }) => searchApplications(query, ctx)),
      },
    ],
    // Orders in steps of 100 so a deployment's own widgets can go in between. Stat tiles and wide
    // sections are laid out separately, so each size counts on its own. The infrastructure
    // package's clusters tile is 400.
    'home.widgets': [
      {
        id: 'applications',
        title: 'Applications',
        size: 'stat',
        order: 100,
        component: ApplicationsTile,
      },
      { id: 'services', title: 'Services', size: 'stat', order: 200, component: ServicesTile },
      { id: 'instances', title: 'Instances', size: 'stat', order: 300, component: InstancesTile },
      {
        id: 'needs-attention',
        title: 'Needs attention',
        size: 'wide',
        order: 100,
        component: NeedsAttention,
      },
      {
        id: 'recent-applications',
        title: 'Recent applications',
        size: 'wide',
        order: 200,
        component: RecentApplications,
      },
    ],
  },
});
