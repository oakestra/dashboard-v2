import { defineAddon } from '@oakestra/dashboard-sdk';
import { WaypointsIcon } from 'lucide-react';
import { lazy } from 'react';

import { INFRASTRUCTURE_ROLES } from './roles';

// Exported for the shell test that keeps this copy equal to the infrastructure package's roles.
export { INFRASTRUCTURE_ROLES };

const FleetPage = lazy(() => import('./pages/FleetPage').then((m) => ({ default: m.FleetPage })));

export default defineAddon({
  id: 'fleet',
  // Also the first breadcrumb, so the route needs no crumb of its own.
  label: 'Fleet',
  routes: [
    // No roles: everyone sees the applications they may see, and the clusters need no token.
    { index: true, fullWidth: true, Component: FleetPage },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'fleet',
        label: 'Fleet',
        path: '',
        icon: WaypointsIcon,
        group: 'main',
        // Between Overview (0) and Applications (10).
        order: 5,
      },
    ],
    'command.actions': [
      {
        id: 'exceptions',
        label: 'Show fleet exceptions',
        description: 'Only what cannot run or needs attention',
        keywords: ['problems', 'failed', 'unplaced'],
        path: '?only=exceptions',
        icon: WaypointsIcon,
      },
    ],
  },
});
