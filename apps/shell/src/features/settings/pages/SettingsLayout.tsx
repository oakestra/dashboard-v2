import { PageHeader } from '@oakestra/ui';
import { Outlet } from 'react-router';

export function SettingsLayout() {
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />
      <Outlet />
    </div>
  );
}
