import { hasAnyRole, type Role } from '@oakestra/dashboard-sdk';
import { data, redirect, type LoaderFunction, type LoaderFunctionArgs } from 'react-router';

import { appRouterContext } from '../router/app-context';

export const LOGIN_PATH = '/login';

export function loginPath(redirectTo?: string): string {
  if (!redirectTo || redirectTo === '/') return LOGIN_PATH;
  return `${LOGIN_PATH}?${new URLSearchParams({ redirectTo })}`;
}

/** Only same-origin paths, so a crafted login link cannot send users elsewhere afterwards. */
export function safeRedirectTarget(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

/** Loader for everything behind the login. Restores the session from the refresh token if needed. */
export async function requireAuth({ context, request }: LoaderFunctionArgs): Promise<null> {
  if (await context.get(appRouterContext).auth.ensureSession()) return null;
  const url = new URL(request.url);
  throw redirect(loginPath(url.pathname + url.search));
}

export const FORBIDDEN_MESSAGE = 'You do not have permission to view this page.';

/**
 * Loader for pages limited to some roles. Users without any of them get a 403 error page; the nav
 * should not have offered the link in the first place.
 */
export function requireRole(...roles: Role[]): LoaderFunction {
  return async (args) => {
    await requireAuth(args);
    const user = args.context.get(appRouterContext).auth.store.getState().user;
    if (!hasAnyRole(user, roles)) {
      throw data(FORBIDDEN_MESSAGE, { status: 403 });
    }
    return null;
  };
}

/** Loader for /login: an existing session goes straight to where the user wanted to be. */
export async function redirectIfAuthenticated({
  context,
  request,
}: LoaderFunctionArgs): Promise<null> {
  if (await context.get(appRouterContext).auth.ensureSession()) {
    throw redirect(safeRedirectTarget(new URL(request.url).searchParams.get('redirectTo')));
  }
  return null;
}
