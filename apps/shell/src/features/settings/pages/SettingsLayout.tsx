import { Outlet } from 'react-router';

export function SettingsLayout() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Preferences for this dashboard.</p>
      </div>
      <Outlet />
    </div>
  );
}
