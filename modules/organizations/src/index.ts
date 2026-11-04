import { defineAddon, organizationsQuery, useOakestraApi } from '@oakestra/dashboard-sdk';
import type { AddonCrumbProps } from '@oakestra/dashboard-sdk';
import { useQuery } from '@tanstack/react-query';
import { BuildingIcon } from 'lucide-react';
import { lazy } from 'react';

const OrganizationsPage = lazy(() =>
  import('./pages/OrganizationsPage').then((m) => ({ default: m.OrganizationsPage })),
);
const OrganizationDetailPage = lazy(() =>
  import('./pages/OrganizationDetailPage').then((m) => ({ default: m.OrganizationDetailPage })),
);

/**
 * There is no detail endpoint, so the name comes from the list the page uses too (one cache
 * entry). A failed or still empty lookup shows "Details"; the page renders its own error and
 * not-found states.
 */
function OrganizationCrumb({ params }: AddonCrumbProps) {
  const api = useOakestraApi();
  const { data } = useQuery({
    ...organizationsQuery(api),
    select: (organizations) => organizations.find((org) => org._id === params.orgId)?.name,
  });
  return data ?? 'Details';
}

export default defineAddon({
  id: 'organizations',
  // The first crumb, linking to the list, so the index route needs none.
  label: 'Organizations',
  routes: [
    {
      // Organization endpoints need Admin; Organization_Admins would only see 403s.
      roles: ['Admin'],
      children: [
        { index: true, Component: OrganizationsPage },
        { path: ':orgId', crumb: OrganizationCrumb, Component: OrganizationDetailPage },
      ],
    },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'organizations',
        label: 'Organizations',
        path: '',
        icon: BuildingIcon,
        group: 'management',
        // See the Management ordering note in modules/infrastructure/src/index.ts.
        order: 30,
        roles: ['Admin'],
      },
    ],
  },
});
