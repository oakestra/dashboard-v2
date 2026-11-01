import { isTransitionalAddonStatus, type AddonStatus } from '@oakestra/api';
import { Badge, cn } from '@oakestra/ui';
import { LoaderCircleIcon, TriangleAlertIcon } from 'lucide-react';

const LABELS: Readonly<Record<AddonStatus, string>> = {
  installing: 'Installing',
  active: 'Active',
  partially_active: 'Partially active',
  failed: 'Failed',
  disabling: 'Disabling',
  disabled: 'Disabled',
};

const STYLES: Readonly<Record<AddonStatus, string>> = {
  installing: '',
  disabling: '',
  active: 'bg-emerald-600 text-white dark:bg-emerald-700',
  partially_active: 'bg-amber-500 text-black dark:bg-amber-400',
  failed: '',
  disabled: 'text-muted-foreground',
};

const VARIANTS = {
  installing: 'secondary',
  disabling: 'secondary',
  active: 'default',
  partially_active: 'default',
  failed: 'destructive',
  disabled: 'outline',
} as const satisfies Record<AddonStatus, 'default' | 'secondary' | 'destructive' | 'outline'>;

export function addonStatusLabel(status: AddonStatus): string {
  return LABELS[status];
}

export function AddonStatusBadge({ status }: { status: AddonStatus }) {
  return (
    <Badge variant={VARIANTS[status]} className={cn(STYLES[status])} data-status={status}>
      {isTransitionalAddonStatus(status) ? (
        <LoaderCircleIcon className="animate-spin" aria-hidden />
      ) : status === 'partially_active' ? (
        <TriangleAlertIcon aria-hidden />
      ) : null}
      {LABELS[status]}
    </Badge>
  );
}
