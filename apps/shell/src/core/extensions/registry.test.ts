import type { CurrentUser, Widget } from '@oakestra/dashboard-sdk';
import { describe, expect, it } from 'vitest';

import { createContributionRegistry, selectContributions, sourceKey } from './registry';

const Noop = () => null;
const admin: CurrentUser = { username: 'a', roles: ['Admin'], organization: null };
const provider: CurrentUser = {
  username: 'p',
  roles: ['Application_Provider'],
  organization: null,
};

const widget = (id: string, extra: Partial<Widget> = {}): Widget => ({
  id,
  title: id,
  component: Noop,
  ...extra,
});

describe('contribution registry', () => {
  it('registers and unregisters sources', () => {
    const registry = createContributionRegistry();
    registry.getState().register(
      { kind: 'core', id: 'home', label: 'Home' },
      {
        'home.widgets': [widget('a')],
      },
    );
    expect(Object.keys(registry.getState().sources)).toEqual(['core:home']);

    registry.getState().unregister('core:home');
    expect(registry.getState().sources).toEqual({});
  });

  it('keeps core and addon sources with the same id apart', () => {
    const registry = createContributionRegistry();
    registry.getState().register({ kind: 'core', id: 'x', label: 'x' }, {});
    registry.getState().register(
      {
        kind: 'addon',
        id: 'x',
        label: 'x',
        addon: { addonId: 'x', version: '1', basePath: '/addons/x' },
      },
      {},
    );
    expect(Object.keys(registry.getState().sources).sort()).toEqual(['addon:x', 'core:x']);
    expect(sourceKey({ kind: 'addon', id: 'x' })).toBe('addon:x');
  });

  it('does not emit a change when unregistering an unknown source', () => {
    const registry = createContributionRegistry();
    const before = registry.getState().sources;
    registry.getState().unregister('core:nope');
    expect(registry.getState().sources).toBe(before);
  });
});

describe('selectContributions', () => {
  function setup() {
    const registry = createContributionRegistry();
    registry.getState().register(
      { kind: 'core', id: 'core', label: 'core' },
      {
        'home.widgets': [widget('late'), widget('second', { order: 2 })],
      },
    );
    registry.getState().register(
      { kind: 'core', id: 'other', label: 'other' },
      {
        'home.widgets': [
          widget('first', { order: 1 }),
          widget('admin-only', { order: 3, roles: ['Admin'] }),
          widget('hidden', { visible: () => false }),
          widget('broken', {
            visible: () => {
              throw new Error('boom');
            },
          }),
        ],
      },
    );
    return registry.getState().sources;
  }

  it('sorts by order and then by registration', () => {
    const ids = selectContributions(setup(), 'home.widgets', admin).map(({ item }) => item.id);
    expect(ids).toEqual(['first', 'second', 'admin-only', 'late']);
  });

  it('filters by role', () => {
    const ids = selectContributions(setup(), 'home.widgets', provider).map(({ item }) => item.id);
    expect(ids).not.toContain('admin-only');
  });

  it('hides contributions whose visible() is false or throws', () => {
    const ids = selectContributions(setup(), 'home.widgets', admin).map(({ item }) => item.id);
    expect(ids).not.toContain('hidden');
    expect(ids).not.toContain('broken');
  });

  it('passes the slot context to visible()', () => {
    const registry = createContributionRegistry();
    registry.getState().register(
      { kind: 'core', id: 'c', label: 'c' },
      {
        'cluster.widgets': [
          {
            id: 'only-c1',
            title: 't',
            component: Noop,
            visible: ({ clusterId }) => clusterId === 'c1',
          },
        ],
      },
    );
    const sources = registry.getState().sources;
    expect(
      selectContributions(sources, 'cluster.widgets', admin, { clusterId: 'c1' }),
    ).toHaveLength(1);
    expect(
      selectContributions(sources, 'cluster.widgets', admin, { clusterId: 'c2' }),
    ).toHaveLength(0);
  });
});
