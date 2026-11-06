import { EmptyState } from '@oakestra/ui';
import { SlidersHorizontalIcon } from 'lucide-react';

/**
 * Settings of the platform itself. Addons have no slot here: an addon's settings belong on its own
 * page, linked as a sub-item of its nav entry. Preferences of one person (the theme) belong in the
 * account menu, not here.
 */
export function GeneralSettingsPage() {
  return (
    <EmptyState
      icon={<SlidersHorizontalIcon />}
      title="No platform settings yet"
      description="Settings that apply to everyone on this dashboard will appear here. Your theme is in the account menu."
      className="rounded-lg border border-dashed"
    />
  );
}
