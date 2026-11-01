import type { UIMatch } from 'react-router';

/**
 * Convention for `handle` on core routes. The header renders one breadcrumb per matched route with
 * a `crumb`, linking to that route's path.
 */
export interface Crumb {
  id: string;
  label: string;
  /** Where the crumb links to: the matched pathname of its route. */
  to: string;
}

export interface RouteHandle {
  crumb?: string | ((match: UIMatch) => string);
}

export function crumbOf(match: UIMatch): string | null {
  const handle = match.handle as RouteHandle | undefined;
  if (!handle?.crumb) return null;
  return typeof handle.crumb === 'function' ? handle.crumb(match) : handle.crumb;
}
