import { SettingsIcon } from 'lucide-react';
import { redirect } from 'react-router';

import type { CoreModule } from '../../core/modules';
import type { RouteHandle } from '../../core/router/route-handle';

export const settingsModule: CoreModule = {
  id: 'settings',
  label: 'Settings',
  routes: [
    {
      path: 'settings',
      handle: { crumb: 'Settings' } satisfies RouteHandle,
      lazy: () => import('./pages/SettingsLayout').then((m) => ({ Component: m.SettingsLayout })),
      children: [
        {
          index: true,
          lazy: () =>
            import('./pages/GeneralSettingsPage').then((m) => ({
              Component: m.GeneralSettingsPage,
            })),
        },
        {
          // The addon status page moved into the addon manager, where the Dashboard UI column
          // replaces it. Old bookmarks keep working.
          path: 'addons',
          loader: () => redirect('/addon-manager/installed'),
        },
      ],
    },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'settings',
        label: 'Settings',
        path: '/settings',
        icon: SettingsIcon,
        group: 'management',
        order: 1000,
      },
    ],
  },
};
