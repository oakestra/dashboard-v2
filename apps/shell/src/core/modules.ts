import type { Contributions } from '@oakestra/dashboard-sdk';
import type { RouteObject } from 'react-router';

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
