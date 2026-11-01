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

  it('validates nested routes', () => {
    const module = {
      default: {
        id: 'flops',
        routes: [{ path: 'a', children: [{ path: 'b', Component: 'not a component' }] }],
      },
    };
    expect(() => parseAddonDefinition(module, 'flops')).toThrow(/React component/);
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
