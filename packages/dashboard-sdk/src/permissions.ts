import type { CurrentUser, KnownRole, Role } from './types';

/**
 * True if the user holds at least one of `roles`. An empty or missing list means "everyone", but
 * an anonymous user never matches a non-empty list.
 */
export function hasAnyRole(user: CurrentUser | null, roles: readonly Role[] | undefined): boolean {
  if (!roles || roles.length === 0) return true;
  if (!user) return false;
  return roles.some((role) => user.roles.includes(role));
}

export interface RoleOption {
  value: KnownRole;
  label: string;
  description: string;
}

/** The roles the backend knows, with the wording the dashboard uses for them. */
export const ROLE_OPTIONS: readonly RoleOption[] = [
  {
    value: 'Admin',
    label: 'Admin',
    description: 'Manages users, organizations and the whole platform.',
  },
  {
    value: 'Organization_Admin',
    label: 'Organization Admin',
    description:
      'Administrative role inside one organization. Member management currently requires Admin.',
  },
  {
    value: 'Application_Provider',
    label: 'Application Provider',
    description: 'Creates and deploys applications and services.',
  },
  {
    value: 'Infrastructure_Provider',
    label: 'Infrastructure Provider',
    description: 'Operates clusters and nodes.',
  },
];

/** Display name of a role; unknown roles show as they are. */
export function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}
