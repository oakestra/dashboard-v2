import type { ComponentType } from 'react';

import type { Contributions } from './extension-points';

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
}

export interface AddonDefinition {
  /** Must equal the addon's name in `/ui-addons`, which is also its Module Federation name. */
  id: string;
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
