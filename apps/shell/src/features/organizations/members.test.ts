import type { Organization } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import { removalBlock, rolesBlock } from './members';

const org = (name: string, members: Record<string, string[]>): Organization => ({
  _id: name,
  name,
  member: Object.entries(members).map(([user_id, roles]) => ({ user_id, roles })),
});

describe('member guards', () => {
  it('never lets someone remove themselves', () => {
    const edge = org('edge', { a: ['Admin'], b: ['Admin'] });
    expect(removalBlock(edge, edge.member[0]!, true)).toMatch(/yourself/);
  });

  it('keeps one Admin in the root organization', () => {
    const root = org('root', { a: ['Admin'], b: ['Application_Provider'] });
    expect(removalBlock(root, root.member[0]!, false)).toMatch(/at least one Admin/);
    expect(rolesBlock(root, root.member[0]!, ['Application_Provider'])).toMatch(/at least one/);
    expect(rolesBlock(root, root.member[0]!, ['Admin', 'Application_Provider'])).toBeNull();
    expect(removalBlock(root, root.member[1]!, false)).toBeNull();
  });

  it('allows removing and demoting an Admin while another one is left', () => {
    const root = org('root', { a: ['Admin'], b: ['Admin'] });
    expect(removalBlock(root, root.member[0]!, false)).toBeNull();
    expect(rolesBlock(root, root.member[0]!, [])).toBeNull();
  });

  it('only guards the root organization', () => {
    const edge = org('edge', { a: ['Admin'] });
    expect(removalBlock(edge, edge.member[0]!, false)).toBeNull();
    expect(rolesBlock(edge, edge.member[0]!, [])).toBeNull();
  });
});
