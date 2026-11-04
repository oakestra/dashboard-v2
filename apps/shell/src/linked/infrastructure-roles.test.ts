import { INFRASTRUCTURE_ROLES as copiedRoles } from '@oakestra/module-applications';
import { INFRASTRUCTURE_ROLES } from '@oakestra/module-infrastructure';
import { expect, it } from 'vitest';

// The applications package may not import the infrastructure one at runtime, so it keeps a copy
// of the roles that decide whether an instance links to its cluster page. Only here may both be
// imported.
it('keeps the applications copy of the infrastructure roles in sync', () => {
  expect([...copiedRoles].sort()).toEqual([...INFRASTRUCTURE_ROLES].sort());
});
