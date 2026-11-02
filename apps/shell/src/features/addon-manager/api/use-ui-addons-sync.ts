import type { InstalledAddon } from '@oakestra/api';
import { useEffect, useRef } from 'react';

import { useRefreshUiAddons } from '../../../core/addons/use-refresh-ui-addons';

/**
 * Refetches `/ui-addons` when an addon becomes `active` or stops being it, so its nav items and
 * pages appear or vanish at once instead of at the next 15s poll. `/ui-addons` lists active
 * addons only, which is why those are the transitions that matter. The first list seen is only
 * remembered: whatever state it shows is what the shell already knows.
 */
export function useUiAddonsSync(installed: readonly InstalledAddon[] | undefined): void {
  const refreshUiAddons = useRefreshUiAddons();
  const previous = useRef<ReadonlyMap<string, boolean> | null>(null);

  useEffect(() => {
    if (!installed) return;
    const current = new Map(installed.map((addon) => [addon._id, addon.status === 'active']));
    const before = previous.current;
    previous.current = current;
    if (!before) return;

    const ids = new Set([...before.keys(), ...current.keys()]);
    const changed = [...ids].some((id) => (before.get(id) ?? false) !== (current.get(id) ?? false));
    if (changed) void refreshUiAddons();
  }, [installed, refreshUiAddons]);
}
