import { LayoutDashboardIcon } from 'lucide-react';

import type { CoreModule } from '../../core/modules';

/** The landing page (the index route). */
export const overviewModule: CoreModule = {
  id: 'overview',
  label: 'Overview',
  routes: [
    {
      index: true,
      lazy: () => import('./pages/OverviewPage').then((m) => ({ Component: m.OverviewPage })),
    },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'overview',
        label: 'Overview',
        path: '/',
        icon: LayoutDashboardIcon,
        group: 'main',
        order: 0,
      },
    ],
  },
};
