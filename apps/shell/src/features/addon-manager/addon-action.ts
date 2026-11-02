import type { InstalledAddon } from '@oakestra/api';

export type AddonAction = 'disable' | 'force-disable' | 'remove';

/**
 * The one action an installed addon offers, shared by the table row and the detail sheet so both
 * always agree. A `disabled` addon can only be removed, and an install that has been running for
 * too long (`stuck`) gets "Disable anyway". A plain disable is still the action while an addon is
 * changing; callers show it disabled then.
 */
export function addonAction(addon: InstalledAddon, stuck: boolean): AddonAction {
  if (addon.status === 'disabled') return 'remove';
  if (stuck && addon.status === 'installing') return 'force-disable';
  return 'disable';
}
