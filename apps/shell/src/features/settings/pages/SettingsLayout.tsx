import { PageHeader } from '@oakestra/ui';
import { Outlet } from 'react-router';

export function SettingsLayout() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Preferences for this dashboard." />
      <Outlet />
    </div>
  );
}
