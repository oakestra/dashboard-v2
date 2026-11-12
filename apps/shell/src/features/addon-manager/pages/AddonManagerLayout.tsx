import { isProblemAddonStatus } from '@oakestra/api';
import { PageHeader, StatusDot, cn } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router';

import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import {
  installedAddonsQuery,
  marketplaceAddonsQuery,
  marketplaceSourcesQuery,
} from '../api/queries';
import { useInstallOutcomeToasts } from '../api/use-install-outcome-toasts';
import { useUiAddonsSync } from '../api/use-ui-addons-sync';
import { INSTALLED_PATH, MARKETPLACE_PATH, SOURCES_PATH } from '../paths';

export function AddonManagerLayout() {
  // Mounted for every tab, so a status change is noticed whichever tab is open (the pages share
  // this query and its polling).
  const api = useAddonsAdminApi();
  const installed = useQuery(installedAddonsQuery(api));
  const marketplace = useQuery(marketplaceAddonsQuery(api));
  const sources = useQuery(marketplaceSourcesQuery(api));
  const tabs = [
    {
      to: INSTALLED_PATH,
      label: 'Installed',
      count: installed.data?.length,
      problem: installed.data?.some((addon) => isProblemAddonStatus(addon.status))
        ? 'Some addons need attention'
        : null,
    },
    { to: MARKETPLACE_PATH, label: 'Marketplace', count: marketplace.data?.length, problem: null },
    {
      to: SOURCES_PATH,
      label: 'Sources',
      count: sources.data?.length,
      problem: sources.data?.some((source) => source.last_error)
        ? 'A source could not be synced'
        : null,
    },
  ];
  useUiAddonsSync(installed.data);
  useInstallOutcomeToasts(installed.data);

  return (
    <div className="space-y-4">
      <PageHeader title="Addons" />
      <nav aria-label="Addon sections" className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-3 py-1.5 text-sm font-medium',
                isActive
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )
            }
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="text-muted-foreground ml-1.5 text-xs font-normal tabular-nums">
                {tab.count}
              </span>
            ) : null}
            {tab.problem ? (
              <span className="ml-1.5 inline-flex align-middle">
                <StatusDot tone="warning" />
                <span className="sr-only">{tab.problem}</span>
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
