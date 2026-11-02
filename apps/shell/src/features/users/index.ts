import { UsersIcon } from 'lucide-react';

import { requireRole } from '../../core/auth/guards';
import type { CoreModule } from '../../core/modules';
import type { RouteHandle } from '../../core/router/route-handle';

// The organizations feature resolves member ids through the same user list and picks roles with
// the same widget, so both are exported here instead of duplicated.
export { allUsersQuery, organizationUsersQuery, userKeys } from './api/queries';
export { RoleSelect } from './components/RoleSelect';
export { ROLE_OPTIONS, roleLabel } from './roles';

export const usersModule: CoreModule = {
  id: 'users',
  label: 'Users',
  routes: [
    {
      path: 'users',
      // Every user endpoint in system-manager requires Admin, so Organization_Admins would only
      // ever see 403s here.
      loader: requireRole('Admin'),
      handle: { crumb: 'Users' } satisfies RouteHandle,
      lazy: () => import('./pages/UsersPage').then((m) => ({ Component: m.UsersPage })),
    },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'users',
        label: 'Users',
        path: '/users',
        icon: UsersIcon,
        group: 'management',
        order: 10,
        roles: ['Admin'],
      },
    ],
  },
};
