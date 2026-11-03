import type { CoreModule } from '../../core/modules';
import type { RouteHandle } from '../../core/router/route-handle';

// Other features need the user's `_id` (e.g. for `/applications/{userId}`), which only this query
// returns; they reuse it instead of fetching the same user under another key.
export { profileQuery } from './api/queries';

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
