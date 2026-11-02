import { memo } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AddonDefinitionError, parseAddonDefinition } from './definition';

const Page = () => null;

describe('parseAddonDefinition', () => {
  it('accepts a module with a valid default export', () => {
    const definition = {
      id: 'flops',
      routes: [
        { index: true, Component: Page },
        { path: 'jobs/:id', Component: memo(Page) },
      ],
      contributions: {
        'nav.items': [{ id: 'nav', label: 'Flops', path: '' }],
        'home.widgets': [{ id: 'w', title: 'W', component: Page, visible: () => true }],
      },
    };
    const parsed = parseAddonDefinition({ default: definition }, 'flops');
    expect(parsed.id).toBe('flops');
    expect(parsed.routes?.[0]?.Component).toBe(Page);
    expect(parsed.contributions?.['home.widgets']?.[0]?.component).toBe(Page);
  });

  it('rejects a module without a definition', () => {
    expect(() => parseAddonDefinition({ default: undefined }, 'flops')).toThrow(
      AddonDefinitionError,
    );
    expect(() => parseAddonDefinition(null, 'flops')).toThrow(AddonDefinitionError);
  });

  it('rejects an id that does not match the addon name', () => {
    expect(() => parseAddonDefinition({ default: { id: 'other' } }, 'flops')).toThrow(
      /does not match the addon name "flops"/,
    );
  });

  it('rejects contributions without a component', () => {
    const module = {
      default: { id: 'flops', contributions: { 'home.widgets': [{ id: 'w', title: 'W' }] } },
    };
    expect(() => parseAddonDefinition(module, 'flops')).toThrow(/component/);
  });

  it('rejects duplicate contribution ids within a point', () => {
    const widget = { id: 'w', title: 'W', component: Page };
    const module = {
      default: { id: 'flops', contributions: { 'home.widgets': [widget, widget] } },
    };
    expect(() => parseAddonDefinition(module, 'flops')).toThrow(/duplicate id "w"/);
  });

  it('rejects absolute nav paths and route paths', () => {
    expect(() =>
      parseAddonDefinition(
        {
          default: {
            id: 'flops',
            contributions: { 'nav.items': [{ id: 'n', label: 'N', path: '/admin' }] },
          },
        },
        'flops',
      ),
    ).toThrow(/relative to the addon base path/);
    expect(() =>
      parseAddonDefinition(
        { default: { id: 'flops', routes: [{ path: '/x', Component: Page }] } },
        'flops',
      ),
    ).toThrow(/relative to the addon base path/);
  });

  it('accepts nav sub-items and validates them like top-level items', () => {
    const withChildren = (children: unknown[]) => ({
      default: {
        id: 'flops',
        contributions: {
          'nav.items': [{ id: 'main', label: 'Flops', path: '', children }],
        },
      },
    });

    const parsed = parseAddonDefinition(
      withChildren([
        { id: 'jobs', label: 'Jobs', path: 'jobs', roles: ['Admin'] },
        // Only one level is rendered; a nested `children` key is dropped, not passed on.
        { id: 'logs', label: 'Logs', path: 'logs', children: [{ id: 'x', label: 'X', path: 'x' }] },
      ]),
      'flops',
    );
    expect(parsed.contributions?.['nav.items']?.[0]?.children).toEqual([
      { id: 'jobs', label: 'Jobs', path: 'jobs', roles: ['Admin'] },
      { id: 'logs', label: 'Logs', path: 'logs' },
    ]);

    expect(() =>
      parseAddonDefinition(withChildren([{ id: 'a', label: 'A', path: '/admin' }]), 'flops'),
    ).toThrow(/relative to the addon base path/);
    expect(() =>
      parseAddonDefinition(
        withChildren([{ id: 'a', label: 'A', path: 'https://x.test' }]),
        'flops',
      ),
    ).toThrow(/relative to the addon base path/);
    expect(() =>
      parseAddonDefinition(
        withChildren([
          { id: 'a', label: 'A', path: 'a' },
          { id: 'a', label: 'B', path: 'b' },
        ]),
        'flops',
      ),
    ).toThrow(/duplicate id "a"/);
    expect(() => parseAddonDefinition(withChildren([{ id: 'a', path: 'a' }]), 'flops')).toThrow(
      /label/,
    );
  });

  it('validates nested routes', () => {
    const module = {
      default: {
        id: 'flops',
        routes: [{ path: 'a', children: [{ path: 'b', Component: 'not a component' }] }],
      },
    };
    expect(() => parseAddonDefinition(module, 'flops')).toThrow(/React component/);
  });

  it('keeps the label, route roles, crumbs and widths', () => {
    const parsed = parseAddonDefinition(
      {
        default: {
          id: 'flops',
          label: 'FLOps',
          routes: [
            {
              path: 'admin',
              roles: ['Admin'],
              crumb: 'Admin',
              fullWidth: true,
              children: [{ path: 'jobs', crumb: 'Jobs', fullWidth: false, Component: Page }],
            },
          ],
        },
      },
      'flops',
    );
    expect(parsed.label).toBe('FLOps');
    expect(parsed.routes?.[0]).toMatchObject({ roles: ['Admin'], crumb: 'Admin' });
    expect(parsed.routes?.[0]?.children?.[0]?.crumb).toBe('Jobs');
    expect(parsed.routes?.[0]?.fullWidth).toBe(true);
    expect(parsed.routes?.[0]?.children?.[0]?.fullWidth).toBe(false);
  });

  it.each([
    ['an empty label', { label: '' }, /label/],
    ['a label that is not a string', { label: 42 }, /label/],
    ['roles that are not a list', { routes: [{ path: 'a', roles: 'Admin' }] }, /roles/],
    ['an empty crumb', { routes: [{ path: 'a', crumb: '' }] }, /crumb/],
    [
      'a fullWidth that is not a boolean',
      { routes: [{ path: 'a', fullWidth: 'yes' }] },
      /fullWidth/,
    ],
    [
      'a crumb function',
      { routes: [{ path: 'a', children: [{ path: 'b', crumb: () => 'B' }] }] },
      /crumb/,
    ],
  ])('rejects %s', (_case, fields, message) => {
    expect(() => parseAddonDefinition({ default: { id: 'flops', ...fields } }, 'flops')).toThrow(
      message,
    );
  });

  it('loads an addon that still contributes the removed settings.panels point', () => {
    // Addon settings moved to the addon's own page; old builds keep loading without the panel.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const parsed = parseAddonDefinition(
      {
        default: {
          id: 'flops',
          contributions: {
            'nav.items': [{ id: 'nav', label: 'Flops', path: '' }],
            'settings.panels': [{ id: 's', title: 'S', component: Page }],
          },
        },
      },
      'flops',
    );
    expect(Object.keys(parsed.contributions ?? {})).toEqual(['nav.items']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('flops'), ['settings.panels']);
  });

  it('drops extension points this shell does not know', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const parsed = parseAddonDefinition(
      { default: { id: 'flops', contributions: { 'future.point': [{ id: 'x' }] } } },
      'flops',
    );
    expect(parsed.contributions).toEqual({});
    expect(warn).toHaveBeenCalled();
  });
});
