import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { DataRouter } from 'react-router';

import { uiAddonsQueryKey } from '../core/addons/ui-addons';
import { useAuthSession } from '../core/auth/auth-context';
import { LOGIN_PATH, loginPath } from '../core/auth/guards';
import { notify } from '../core/notify/notify';

const PUBLIC_PATHS = [LOGIN_PATH, '/reset-password', '/resetPassword'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Reacts to the end of a session (logout, rejected refresh token, logout in another tab): leave
 * the page first, then drop every cached query, so nothing of the previous user is shown to the
 * next one. The addon list is kept; it is not user data and the poll would only fetch it again.
 */
export function SessionWatcher({ router }: { router: DataRouter }) {
  const auth = useAuthSession();
  const queryClient = useQueryClient();

  useEffect(() => auth.watchOtherTabs(window), [auth]);

  useEffect(
    () =>
      auth.store.subscribe((state, previous) => {
        if (previous.status !== 'authenticated' || state.status !== 'anonymous') return;
        if (state.lastLogoutReason === 'expired') {
          notify.error('Your session has expired', {
            description: 'Please log in again.',
            id: 'session-expired',
          });
        }
        const { pathname, search } = router.state.location;
        const target = isPublicPath(pathname)
          ? null
          : state.lastLogoutReason === 'user'
            ? LOGIN_PATH
            : loginPath(pathname + search);
        void (target ? router.navigate(target, { replace: true }) : Promise.resolve()).then(() =>
          queryClient.removeQueries({
            predicate: (query) => query.queryKey[0] !== uiAddonsQueryKey[0],
          }),
        );
      }),
    [auth, queryClient, router],
  );

  return null;
}
