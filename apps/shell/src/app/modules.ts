import applications from '@oakestra/module-applications';
import help from '@oakestra/module-help';
import organizations from '@oakestra/module-organizations';
import users from '@oakestra/module-users';
import infrastructure from '@oakestra/module-infrastructure';

import type { LinkedAddon } from '../core/addons/linked-addons';
import type { Preset } from '../core/config/preset';
import type { CoreModule } from '../core/modules';
import { addonManagerModule } from '../features/addon-manager';
import { authModule } from '../features/auth';
import { overviewModule } from '../features/overview';
import { profileModule } from '../features/profile';
import { settingsModule } from '../features/settings';

/** Every built-in feature. Order matters only for nav items without an explicit `order`. */
export const coreModules: readonly CoreModule[] = [
  authModule,
  overviewModule,
  addonManagerModule,
  profileModule,
  settingsModule,
];

/**
 * Addon packages from `modules/*` compiled into the shell, each at a fixed mount. They share one id
 * namespace with the core modules: a preset's `modules` selects both, and a preset addon with the
 * same name replaces the linked one under its mount. The mount is a public URL, like a core route.
 */
export const linkedAddons: readonly LinkedAddon[] = [
  { definition: applications, mount: '/applications' },
  { definition: help, mount: '/help' },
  { definition: users, mount: '/users' },
  { definition: organizations, mount: '/organizations' },
  { definition: infrastructure, mount: '/infrastructure' },
];

/** Modules a preset cannot switch off: without `auth` nobody could log in. */
export const ALWAYS_ENABLED_MODULES: readonly string[] = ['auth'];

/** The modules a preset enables, in their original order (which nav items fall back to). */
export function selectModules(
  modules: readonly CoreModule[],
  preset: Pick<Preset, 'modules'>,
): CoreModule[] {
  const enabled = preset.modules;
  if (!enabled) return [...modules];
  return modules.filter(
    (module) => ALWAYS_ENABLED_MODULES.includes(module.id) || enabled.includes(module.id),
  );
}

/** The linked addons a preset enables, minus those its own addons replace. */
export function selectLinkedAddons(
  linked: readonly LinkedAddon[],
  preset: Pick<Preset, 'modules' | 'addons'>,
): LinkedAddon[] {
  const replaced = new Set(preset.addons.map((addon) => addon.name));
  return linked.filter(
    ({ definition: { id } }) =>
      !replaced.has(id) && (preset.modules === undefined || preset.modules.includes(id)),
  );
}
