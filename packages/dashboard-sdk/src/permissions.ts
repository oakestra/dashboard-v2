import type { CurrentUser, Role } from './types';

/**
 * True if the user holds at least one of `roles`. An empty or missing list means "everyone", but
 * an anonymous user never matches a non-empty list.
 */
export function hasAnyRole(user: CurrentUser | null, roles: readonly Role[] | undefined): boolean {
  if (!roles || roles.length === 0) return true;
  if (!user) return false;
  return roles.some((role) => user.roles.includes(role));
}
