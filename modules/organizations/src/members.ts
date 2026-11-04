import { ROOT_ORGANIZATION_NAME, type Organization, type OrganizationMember } from '@oakestra/api';

const ADMIN = 'Admin';

export function adminCount(organization: Organization): number {
  return organization.member.filter((member) => member.roles.includes(ADMIN)).length;
}

/**
 * Why `member` cannot be removed, or null. Nobody removes themselves (the session would lose its
 * access mid-click), and the root organization always keeps one Admin: it is the only way back
 * into user and organization management.
 */
export function removalBlock(
  organization: Organization,
  member: OrganizationMember,
  isSelf: boolean,
): string | null {
  if (isSelf) return 'You cannot remove yourself from the organization.';
  return lastAdminBlock(organization, member, []);
}

/** Why `member` cannot be given `roles` instead of what they have, or null. */
export function rolesBlock(
  organization: Organization,
  member: OrganizationMember,
  roles: readonly string[],
): string | null {
  return lastAdminBlock(organization, member, roles);
}

function lastAdminBlock(
  organization: Organization,
  member: OrganizationMember,
  remainingRoles: readonly string[],
): string | null {
  const isLastRootAdmin =
    organization.name === ROOT_ORGANIZATION_NAME &&
    member.roles.includes(ADMIN) &&
    !remainingRoles.includes(ADMIN) &&
    adminCount(organization) <= 1;
  return isLastRootAdmin
    ? 'The root organization needs at least one Admin. Make someone else an Admin first.'
    : null;
}
