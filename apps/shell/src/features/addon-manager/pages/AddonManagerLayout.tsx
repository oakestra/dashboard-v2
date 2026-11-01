import { PageHeader, cn } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router';

import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { installedAddonsQuery } from '../api/queries';
import { useUiAddonsSync } from '../api/use-ui-addons-sync';

const TABS = [
  { to: '/addon-manager/installed', label: 'Installed' },
  { to: '/addon-manager/marketplace', label: 'Marketplace' },
] as const;

export function AddonManagerLayout() {
  // Mounted for both tabs, so a status change is noticed whichever tab is open (the pages share
  // this query and its polling).
  const installed = useQuery(installedAddonsQuery(useAddonsAdminApi()));
  useUiAddonsSync(installed.data);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Addons"
        description="Install, inspect and remove the addons that extend this platform."
      />
      <nav aria-label="Addon sections" className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
