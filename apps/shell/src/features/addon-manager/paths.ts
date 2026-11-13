// Kept free of imports so components and hooks of this feature can use the paths without pulling
// in the module definition from index.ts.
export const INSTALLED_PATH = '/addon-manager/installed';
export const MARKETPLACE_PATH = '/addon-manager/marketplace';
export const SOURCES_PATH = '/addon-manager/sources';

/** The installed tab with the details dialog of one addon open. */
export function installedAddonLink(id: string): string {
  return `${INSTALLED_PATH}?addon=${encodeURIComponent(id)}`;
}

/** The marketplace narrowed to one source. */
export function marketplaceSourceLink(source: string): string {
  return `${MARKETPLACE_PATH}?source=${encodeURIComponent(source)}`;
}
