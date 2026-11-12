import { isTransitionalAddonStatus, type AddonStatus } from '@oakestra/api';
import { StatusBadge, type StatusTone } from '@oakestra/ui';
import { LoaderCircleIcon } from 'lucide-react';

const LABELS: Readonly<Record<AddonStatus, string>> = {
  installing: 'Installing',
  updating: 'Updating',
  active: 'Active',
  partially_active: 'Partially active',
  failed: 'Failed',
  disabling: 'Disabling',
  disabled: 'Disabled',
};

/** The one place that decides which color an addon status gets. */
const ADDON_STATUS_TONES: Readonly<Record<AddonStatus, StatusTone>> = {
  installing: 'info',
  updating: 'info',
  disabling: 'info',
  active: 'success',
  partially_active: 'warning',
  failed: 'destructive',
  disabled: 'neutral',
};

export function addonStatusLabel(status: AddonStatus): string {
  return LABELS[status];
}

export function AddonStatusBadge({ status }: { status: AddonStatus }) {
  return (
    <StatusBadge
      tone={ADDON_STATUS_TONES[status]}
      data-status={status}
      icon={
        // Only work in progress gets its own glyph; every other state keeps the standard dot.
        isTransitionalAddonStatus(status) ? (
          <LoaderCircleIcon className="animate-spin" aria-hidden />
        ) : undefined
      }
    >
      {LABELS[status]}
    </StatusBadge>
  );
}
