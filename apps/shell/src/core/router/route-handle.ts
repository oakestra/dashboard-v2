import type { ReactNode } from 'react';
import type { UIMatch } from 'react-router';

/**
 * Convention for `handle` on core routes. The header renders one breadcrumb per matched route with
 * a `crumb`, linking to that route's path.
 */
export interface Crumb {
  id: string;
  /** Text, or an element for addon crumbs that render their label themselves. */
  label: ReactNode;
  /** Where the crumb links to: the matched pathname of its route. */
  to: string;
}

export interface RouteHandle {
  crumb?: string | ((match: UIMatch) => string);
  /** Drops the layout's centered column for this route and its children, see `pageFullWidth`. */
  fullWidth?: boolean;
}

/**
 * Whether the page fills the width next to the sidebar, from the `fullWidth` of every matched
 * route, outermost first. The deepest one that sets it decides, so a child can opt back out.
 */
export function pageFullWidth(values: readonly (boolean | undefined)[]): boolean {
  return values.findLast((value) => value !== undefined) ?? false;
}

export function crumbOf(match: UIMatch): string | null {
  const handle = match.handle as RouteHandle | undefined;
  if (!handle?.crumb) return null;
  return typeof handle.crumb === 'function' ? handle.crumb(match) : handle.crumb;
}
