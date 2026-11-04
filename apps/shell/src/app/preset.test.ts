import { describe, expect, it, vi } from 'vitest';

import { ConfigError } from '../core/config/config';
import { parsePreset, type PresetInput } from '../core/config/preset';
import { isModuleEnabled } from '../core/modules';
import { coreModules, linkedAddons, selectLinkedAddons, selectModules } from './modules';
import { applyPreset } from './preset';

const apply = (raw: PresetInput) => applyPreset(coreModules, linkedAddons, parsePreset(raw));
const linkedIds = (raw: PresetInput) => apply(raw).linked.map((addon) => addon.definition.id);
const addon = (name: string, mount?: string) => ({
  name,
  version: '1.0.0',
  sdk: '^0.1.0',
  entry: `/bundled-addons/${name}/mf-manifest.json`,
  ...(mount ? { mount } : {}),
});

describe('selectModules', () => {
  it('keeps every module without a list, and auth plus the listed ones in their order', () => {
    expect(selectModules(coreModules, {})).toEqual(coreModules);
    expect(
      selectModules(coreModules, { modules: ['settings', 'profile'] }).map((m) => m.id),
    ).toEqual(['auth', 'profile', 'settings']);
  });
});

describe('applyPreset', () => {
  it('passes the default preset through with every module', () => {
    const { modules, preset } = apply({});
    expect(modules).toEqual(coreModules);
    expect(isModuleEnabled(preset, 'users')).toBe(true);
  });

  it('lists auth as enabled, so useModuleEnabled agrees with the selection', () => {
    const { preset } = apply({ modules: ['overview', 'help'] });
    expect(preset.modules).toEqual(['auth', 'overview', 'help']);
    expect(isModuleEnabled(preset, 'auth')).toBe(true);
    expect(isModuleEnabled(preset, 'users')).toBe(false);
  });

  it('rejects unknown module ids, naming the known ones', () => {
    expect(() => apply({ modules: ['overview', 'aplications'] })).toThrow(ConfigError);
    expect(() => apply({ modules: ['overview', 'aplications'] })).toThrow(
      /unknown modules "aplications" \(known: auth, overview, .*applications/,
    );
  });

  it('requires home when no enabled module owns the start page', () => {
    expect(() => apply({ modules: ['applications'] })).toThrow(/"home" is required/);
    expect(apply({ modules: ['applications'], home: '/applications' }).modules).toHaveLength(1);
    expect(linkedIds({ modules: ['applications'], home: '/applications' })).toEqual([
      'applications',
    ]);
  });

  it('rejects an addon named like a built-in module, enabled or not', () => {
    expect(() => apply({ modules: ['overview'], addons: [addon('settings')] })).toThrow(
      /addon "settings" has the id of a built-in module/,
    );
  });

  it.each([
    ['/profile', '/profile'],
    ['/reset-password/x', '/reset-password/:token'],
    ['/addons/x', '/addons/:addonId/*'],
    ['/login', '/login'],
    ['/settings', '/settings'],
  ])('rejects the mount %s, which overlaps a module route', (mount, route) => {
    expect(() => apply({ addons: [addon('acme', mount)] })).toThrow(
      new RegExp(
        `mount "${mount}" of addon "acme" overlaps the route "${route.replaceAll('*', '\\*')}"`,
      ),
    );
  });

  it('accepts mounts in the space of a disabled module or of no module', () => {
    expect(() =>
      apply({
        modules: ['overview', 'applications'],
        addons: [addon('acme-infra', '/infrastructure'), addon('acme-billing', '/billing/eu')],
      }),
    ).not.toThrow();
  });

  it('reports every problem at once', () => {
    expect(() =>
      apply({ modules: ['nope', 'help'], addons: [addon('settings', '/help')] }),
    ).toThrow(/unknown modules[\s\S]*built-in module[\s\S]*"home" is required[\s\S]*overlaps/);
  });
});

describe('applyPreset with linked addons', () => {
  it('selects linked addons by id like core modules', () => {
    expect(linkedIds({})).toEqual(linkedAddons.map((addon) => addon.definition.id));
    expect(linkedIds({ modules: ['overview', 'help'] })).toEqual(['help']);
    expect(linkedIds({ modules: ['overview'] })).toEqual([]);
    expect(apply({ modules: ['overview'] }).modules.map((m) => m.id)).toEqual(['auth', 'overview']);
  });

  it('lets a preset addon replace a linked one under its mount', () => {
    const { linked, preset } = apply({ addons: [addon('help')] });
    expect(linked.map((addon) => addon.definition.id)).not.toContain('help');
    expect(preset.addons[0]).toMatchObject({ name: 'help', mount: '/help' });
    // It is enabled through the preset's addons even when `modules` leaves the linked one out.
    expect(
      isModuleEnabled(apply({ modules: ['overview'], addons: [addon('help')] }).preset, 'help'),
    ).toBe(true);
  });

  it('keeps the mount a replacement sets itself', () => {
    expect(apply({ addons: [addon('help', '/support')] }).preset.addons[0]?.mount).toBe('/support');
  });

  it('rejects preset mounts that overlap a linked addon', () => {
    expect(() => apply({ addons: [addon('acme', '/help/acme')] })).toThrow(
      /mount "\/help" of addon "help" overlaps the mount "\/help\/acme" of addon "acme"/,
    );
    expect(() => apply({ modules: ['overview'], addons: [addon('acme', '/help')] })).not.toThrow();
    expect(() => apply({ addons: [addon('acme', '/applications/x')] })).toThrow(
      /mount "\/applications" of addon "applications" overlaps the mount "\/applications\/x"/,
    );
    expect(() => apply({ addons: [addon('acme', '/infrastructure/clusters')] })).toThrow(
      /mount "\/infrastructure" of addon "infrastructure" overlaps the mount "\/infrastructure\/clusters"/,
    );
  });

  it('rejects two addons on one mount', () => {
    expect(() => apply({ addons: [addon('acme', '/x'), addon('other', '/x')] })).toThrow(
      /mount "\/x" of addon "acme" overlaps the mount "\/x" of addon "other"/,
    );
  });

  it('warns about nav keys no enabled module or linked addon contributes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    apply({
      nav: {
        items: {
          'core:settings:settings': { hidden: true },
          'core:settings:typo': { hidden: true },
          'addon:help:typo': { hidden: true },
          'addon:not-loaded-yet:home': { hidden: true },
        },
      },
    });
    expect(warn.mock.calls.map(([message]) => message as string)).toEqual([
      expect.stringContaining('core:settings:typo'),
      expect.stringContaining('addon:help:typo'),
    ]);
    warn.mockRestore();
  });

  it('keeps the mounts of the linked addons clear of module routes', () => {
    expect(() => apply({})).not.toThrow();
  });

  it('selectLinkedAddons drops replaced and unselected addons', () => {
    expect(selectLinkedAddons(linkedAddons, { addons: [] })).toEqual(linkedAddons);
    expect(selectLinkedAddons(linkedAddons, { modules: [], addons: [] })).toEqual([]);
  });
});
