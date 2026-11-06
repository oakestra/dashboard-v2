import type { Role } from '@oakestra/dashboard-sdk';

/**
 * Who may open the cluster pages. A copy of `INFRASTRUCTURE_ROLES` in `modules/infrastructure`,
 * which this package may not import; `infrastructure-roles.test.ts` in the shell keeps them equal.
 */
export const INFRASTRUCTURE_ROLES: readonly Role[] = ['Admin', 'Infrastructure_Provider'];

/**
 * Who gets offered a new application. The backend accepts anyone with a token, but someone who only
 * runs infrastructure should not be pushed towards deploying things.
 */
export const APPLICATION_ROLES: readonly Role[] = ['Admin', 'Application_Provider'];
