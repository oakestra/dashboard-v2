import type { Contributions } from '@oakestra/dashboard-sdk';
import type { RouteObject } from 'react-router';

import { usePreset } from './config/preset-context';
import type { Preset } from './config/preset';

/**
 * A built-in feature. It contributes through the same registry as addons do; only its routes are
 * static, because core pages are known at build time and benefit from data router loaders.
 */
export interface CoreModule {
  id: string;
  label: string;
  /**
   * Pages behind the login, rendered inside the app layout. Paths are relative to `/`. Use
   * `handle: { crumb }` (see core/router/route-handle.ts) for breadcrumbs and `requireRole(...)`
   * as loader for role-restricted pages.
   */
  routes: RouteObject[];
  /** Pages reachable without a session (login, password reset), rendered in the auth layout. */
  publicRoutes?: RouteObject[];
  contributions?: Contributions;
}

/**
 * Whether the deployment preset enables the module `id`: a core module or linked addon it selects,
 * or one of its own addons (which may replace a linked addon of that name). Module ids are plain
 * strings, so core and features can ask about any module without importing it. Bootstrap rejects
 * presets that name unknown modules, so a `true` here means the module's routes exist. The SDK's
 * useFeatureEnabled answers from this too.
 */
export function isModuleEnabled(preset: Pick<Preset, 'modules' | 'addons'>, id: string): boolean {
  return (
    preset.modules === undefined ||
    preset.modules.includes(id) ||
    preset.addons.some((addon) => addon.name === id)
  );
}

/** Guard for links into another module, which a preset may have left out. */
export function useModuleEnabled(id: string): boolean {
  return isModuleEnabled(usePreset(), id);
}
