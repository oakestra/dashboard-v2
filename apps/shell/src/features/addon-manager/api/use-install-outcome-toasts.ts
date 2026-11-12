import { isProblemAddonStatus, type AddonStatus, type InstalledAddon } from '@oakestra/api';
import { toast } from '@oakestra/ui';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { installedAddonLink } from '../paths';

export type InstallOutcome = 'active' | 'partially_active' | 'failed';

/**
 * What a status change means for the person who started an install, update or approval. `active`
 * counts as a starting point too: the reconcile loop only notices a crashed container some time
 * after the addon looked healthy, and that is news as well.
 */
export function installOutcome(
  before: AddonStatus | undefined,
  after: AddonStatus,
): InstallOutcome | null {
  const deploying = before === 'installing' || before === 'updating';
  if (!deploying && before !== 'active') return null;
  if (isProblemAddonStatus(after)) return after;
  return deploying && after === 'active' ? 'active' : null;
}

/**
 * Announces how an install or update ended, because the start toast only says it began and the person has
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
        onClick: () => void navigate(installedAddonLink(addon._id)),
      };
      if (outcome === 'active') toast.success(`${addon.name} is active`);
      else if (outcome === 'partially_active') {
        toast.warning(`${addon.name} is only partially active`, { action: details });
      } else toast.error(`${addon.name} failed`, { action: details });
    }
  }, [installed, navigate]);
}
