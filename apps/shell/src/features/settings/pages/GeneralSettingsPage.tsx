import { SectionCard } from '@oakestra/ui';

import { AppearancePanel } from '../components/AppearancePanel';

/**
 * Settings of the dashboard itself. Addons have no slot here: an addon's settings belong on its
 * own page, linked as a sub-item of its nav entry, so this page never mixes in addon concerns.
 */
export function GeneralSettingsPage() {
  return (
    <div className="space-y-4">
      <SectionCard title="Appearance" description="Choose how the dashboard looks on this device.">
        <AppearancePanel />
      </SectionCard>
    </div>
  );
}
