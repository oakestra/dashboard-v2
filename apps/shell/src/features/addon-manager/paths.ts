// Kept free of imports so components and hooks of this feature can use the paths without pulling
// in the module definition from index.ts.
export const INSTALLED_PATH = '/addon-manager/installed';
export const MARKETPLACE_PATH = '/addon-manager/marketplace';

/** The installed tab with the detail sheet of one addon open. */
export function installedAddonLink(id: string): string {
  return `${INSTALLED_PATH}?addon=${encodeURIComponent(id)}`;
}
