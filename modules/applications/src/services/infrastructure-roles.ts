import type { Role } from '@oakestra/dashboard-sdk';

/**
 * Who may open the infrastructure pages, so the cluster only links there for them. The pages live
 * in modules/infrastructure, which this package may not import at runtime, so this is a copy.
 * apps/shell/src/linked/infrastructure-roles.test.ts checks that both agree.
 */
export const INFRASTRUCTURE_ROLES: readonly Role[] = ['Admin', 'Infrastructure_Provider'];
