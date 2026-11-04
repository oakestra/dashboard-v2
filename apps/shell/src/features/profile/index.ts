import type { CoreModule } from '../../core/modules';
import type { RouteHandle } from '../../core/router/route-handle';

/**
 * The user's own account. Reached through the user menu, so it contributes no nav item.
 *
 * This module is the reference for feature modules; see "Feature modules" in AGENTS.md.
 */
export const profileModule: CoreModule = {
  id: 'profile',
  label: 'Profile',
  routes: [
    {
      path: 'profile',
      handle: { crumb: 'Profile' } satisfies RouteHandle,
      lazy: () => import('./pages/ProfilePage').then((m) => ({ Component: m.ProfilePage })),
    },
  ],
};
