import { redirect } from 'react-router';

import { redirectIfAuthenticated } from '../../core/auth/guards';
import type { CoreModule } from '../../core/modules';

export const authModule: CoreModule = {
  id: 'auth',
  label: 'Authentication',
  routes: [],
  publicRoutes: [
    {
      path: 'login',
      loader: redirectIfAuthenticated,
      lazy: () => import('./pages/LoginPage').then((m) => ({ Component: m.LoginPage })),
    },
    {
      path: 'reset-password',
      lazy: () =>
        import('./pages/RequestResetPage').then((m) => ({ Component: m.RequestResetPage })),
    },
    {
      path: 'reset-password/:token',
      lazy: () =>
        import('./pages/ResetPasswordPage').then((m) => ({ Component: m.ResetPasswordPage })),
    },
    {
      // The system-manager hardcodes this path into the reset email.
      path: 'resetPassword/:token',
      loader: ({ params }) => redirect(`/reset-password/${params.token ?? ''}`),
    },
  ],
};
