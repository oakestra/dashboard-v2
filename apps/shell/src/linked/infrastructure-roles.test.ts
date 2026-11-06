import { INFRASTRUCTURE_ROLES as applicationsCopy } from '@oakestra/module-applications';
import { INFRASTRUCTURE_ROLES as fleetCopy } from '@oakestra/module-fleet';
import { INFRASTRUCTURE_ROLES } from '@oakestra/module-infrastructure';
import { expect, it } from 'vitest';

// Packages may not import the infrastructure one at runtime, so those that link to a cluster page
// keep a copy of the roles that decide whether they may. Only here may all of them be imported.
it.each([
  ['applications', applicationsCopy],
  ['fleet', fleetCopy],
])('keeps the %s copy of the infrastructure roles in sync', (_, copy) => {
  expect([...copy].sort()).toEqual([...INFRASTRUCTURE_ROLES].sort());
});
