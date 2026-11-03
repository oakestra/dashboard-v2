import type { ComponentType } from 'react';

import type { Contributions } from './extension-points';
import type { Role } from './types';

/** Props of a component `crumb`. */
export interface AddonCrumbProps {
  /** Params of the matched addon route, e.g. `{ clusterId: '...' }` for `clusters/:clusterId`. */
  readonly params: Readonly<Record<string, string | undefined>>;
}

/**
 * A page of an addon, mounted below `/addons/<id>/`.
 *
 * Route data loading is not supported here because addon routes are attached after the router is
 * created. Use TanStack Query inside the component instead.
 */
export interface AddonRoute {
  /** Relative to the addon base path. Omit it together with `index: true` for the index route. */
  path?: string;
  index?: boolean;
  Component?: ComponentType;
  children?: readonly AddonRoute[];
  /**
   * Roles allowed to open this route and everything below it. Missing or empty means everyone.
   * Others get the shell's "Access denied" page, the same one core pages show. `roles` on a nav
   * item only hides the link; this is what keeps a typed URL out.
   */
  roles?: readonly Role[];
  /**
   * Breadcrumb for this route, shown after the addon's own crumb and linking to the matched path.
   * Routes without one add no crumb. A component renders a label that depends on the URL, e.g. a
   * cluster name fetched with `useQuery`: it gets the route params and renders in the header,
   * outside the page, so it must not rely on anything the page provides. While it suspends or
   * after it throws, the shell shows the last matched path segment instead.
   */
  crumb?: string | ComponentType<AddonCrumbProps>;
  /**
   * Lets the page use the whole width next to the sidebar instead of the shell's centered column,
   * for pages that are mostly a canvas, editor or split view. Applies to the route's children
   * too; the deepest matched route that sets it decides, so a child can set `false` again.
   * Shells that predate this field ignore it and show the page in the centered column.
   */
  fullWidth?: boolean;
}

export interface AddonDefinition {
  /** Must equal the addon's name in `/ui-addons`, which is also its Module Federation name. */
  id: string;
  /**
   * Human-readable name of the addon's UI, e.g. for its breadcrumb and in the addon manager.
   * Defaults to `id`.
   */
  label?: string;
  routes?: readonly AddonRoute[];
  contributions?: Contributions;
}

/**
 * Declares an addon. The returned object is what `./addon` must export as its default export.
 *
 * This is an identity function; it exists so addon authors get type checking and completion
 * without having to spell out the type.
 */
export function defineAddon<const D extends AddonDefinition>(definition: D): D {
  return definition;
}
