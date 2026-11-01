import { CircleHelpIcon } from 'lucide-react';

import type { CoreModule } from '../../core/modules';
import type { RouteHandle } from '../../core/router/route-handle';

export const helpModule: CoreModule = {
  id: 'help',
  label: 'Help',
  routes: [
    {
      path: 'help',
      handle: { crumb: 'Help' } satisfies RouteHandle,
      lazy: () => import('./pages/HelpPage').then((m) => ({ Component: m.HelpPage })),
    },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'help',
        label: 'Help',
        path: '/help',
        icon: CircleHelpIcon,
        group: 'main',
        // Last in the main group, below every feature.
        order: 900,
      },
    ],
  },
};
