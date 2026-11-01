import type { AddonStatus, InstalledAddon } from '@oakestra/api';
import { toast } from '@oakestra/ui';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

export type InstallOutcome = 'active' | 'partially_active' | 'failed';

/**
 * What a status change means for the person who started the install. `active` counts as a
 * starting point too: the addons monitor only notices a crashed container 30-90s after the
 * install looked successful, and that is news as well.
 */
export function installOutcome(
  before: AddonStatus | undefined,
  after: AddonStatus,
): InstallOutcome | null {
  if (before !== 'installing' && before !== 'active') return null;
  if (after === 'failed' || after === 'partially_active') return after;
  return before === 'installing' && after === 'active' ? 'active' : null;
}

/**
 * Announces how an install ended, because the start toast only says it began and the person has
 * usually moved on by then. The first list seen is only remembered, so opening the page never
 * replays old outcomes.
 */
export function useInstallOutcomeToasts(installed: readonly InstalledAddon[] | undefined): void {
  const navigate = useNavigate();
  const previous = useRef<ReadonlyMap<string, AddonStatus> | null>(null);

  useEffect(() => {
    if (!installed) return;
    const before = previous.current;
    previous.current = new Map(installed.map((addon) => [addon._id, addon.status]));
    if (!before) return;

    for (const addon of installed) {
      const outcome = installOutcome(before.get(addon._id), addon.status);
      if (!outcome) continue;
      const details = {
        label: 'View details',
        onClick: () =>
          void navigate(`/addon-manager/installed?addon=${encodeURIComponent(addon._id)}`),
      };
      if (outcome === 'active') toast.success(`${addon.name} is active`);
      else if (outcome === 'partially_active') {
        toast.warning(`${addon.name} is only partially active`, { action: details });
      } else toast.error(`${addon.name} failed`, { action: details });
    }
  }, [installed, navigate]);
}
