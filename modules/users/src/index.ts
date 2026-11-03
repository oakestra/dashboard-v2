import { defineAddon } from '@oakestra/dashboard-sdk';
import { UsersIcon } from 'lucide-react';
import { lazy } from 'react';

const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })));

export default defineAddon({
  id: 'users',
  // Also the breadcrumb of the page, so the index route needs no crumb of its own.
  label: 'Users',
  routes: [
    {
      index: true,
      // Every user endpoint in system-manager requires Admin, so Organization_Admins would only
      // ever see 403s here.
      roles: ['Admin'],
      Component: UsersPage,
    },
  ],
  contributions: {
    'nav.items': [
      {
        id: 'users',
        label: 'Users',
        path: '',
        icon: UsersIcon,
        group: 'management',
        order: 10,
        roles: ['Admin'],
      },
    ],
  },
});
