import type { InstalledAddon } from '@oakestra/api';

export type AddonAction = 'disable' | 'force-disable' | 'remove';

/**
 * The one lifecycle action an installed addon offers, shared by the table row and the detail
 * sheet so both always agree. A `disabled` addon can only be removed, and an install or update
 * that has been running for too long (`stuck`) gets "Disable anyway". A plain disable is still the
 * action while an addon is changing; callers show it disabled then.
 */
export function addonAction(addon: InstalledAddon, stuck: boolean): AddonAction {
  if (addon.status === 'disabled') return 'remove';
  if (stuck && (addon.status === 'installing' || addon.status === 'updating')) {
    return 'force-disable';
  }
  return 'disable';
}

/** The backend only updates and re-approves addons with nothing in flight. */
const settled = (addon: InstalledAddon) =>
  addon.status === 'active' || addon.status === 'partially_active' || addon.status === 'failed';

/** A newer catalog version exists and the addon can take it now. */
export function canUpdate(addon: InstalledAddon): boolean {
  return addon.update_available && settled(addon);
}

/**
 * Approving signs the grant again and redeploys a failed addon: the way out of `grant signature
 * invalid` and a retry for any other failure. The backend also accepts it for running addons,
 * where it changes nothing visible, so it is only offered for failed ones.
 */
export function canApprove(addon: InstalledAddon): boolean {
  return addon.status === 'failed';
}
