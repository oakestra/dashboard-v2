import { PuzzleIcon } from 'lucide-react';
import { redirect, type LoaderFunctionArgs } from 'react-router';

import { requireRole } from '../../core/auth/guards';
import type { CoreModule } from '../../core/modules';
import type { RouteHandle } from '../../core/router/route-handle';

import { INSTALLED_PATH } from './paths';

export { addonManagerKeys } from './keys';
export { INSTALLED_PATH, MARKETPLACE_PATH, SOURCES_PATH, installedAddonLink } from './paths';

const requireAdmin = requireRole('Admin');

/**
 * Installed addons, the marketplace and its sources, Admin only. The prefix is `addon-manager` because
 * `/addons/:addonId/*` belongs to the pages of the addons themselves.
 */
export const addonManagerModule: CoreModule = {
  id: 'addon-manager',
  label: 'Addons',
  routes: [
    {
      path: 'addon-manager',
      loader: requireAdmin,
      handle: { crumb: 'Addons' } satisfies RouteHandle,
      lazy: () =>
        import('./pages/AddonManagerLayout').then((m) => ({ Component: m.AddonManagerLayout })),
      children: [
        {
          index: true,
          // Loaders of a route and its parent run in parallel; checking the role here keeps a
          // non-admin on the 403 page instead of racing the redirect.
          loader: async (args: LoaderFunctionArgs) => {
            await requireAdmin(args);
            throw redirect(INSTALLED_PATH);
          },
        },
        {
          path: 'installed',
          handle: { crumb: 'Installed' } satisfies RouteHandle,
          lazy: () => import('./pages/InstalledPage').then((m) => ({ Component: m.InstalledPage })),
        },
        {
          path: 'marketplace',
          handle: { crumb: 'Marketplace' } satisfies RouteHandle,
          lazy: () =>
            import('./pages/MarketplacePage').then((m) => ({ Component: m.MarketplacePage })),
        },
        {
          path: 'sources',
          handle: { crumb: 'Sources' } satisfies RouteHandle,
          lazy: () => import('./pages/SourcesPage').then((m) => ({ Component: m.SourcesPage })),
        },
      ],
    },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'addon-manager',
        label: 'Addons',
        path: '/addon-manager',
        icon: PuzzleIcon,
        group: 'management',
        // See the Management ordering note in modules/infrastructure/src/index.ts.
        order: 40,
        roles: ['Admin'],
      },
    ],
  },
};
