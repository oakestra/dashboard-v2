import { PageHeader, StatusDot, cn } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router';

import { useAddonsAdminApi } from '../../../core/addons/addons-admin';
import { installedAddonsQuery, marketplaceAddonsQuery } from '../api/queries';
import { useInstallOutcomeToasts } from '../api/use-install-outcome-toasts';
import { useReviewOutcomes } from '../api/use-review-outcomes';
import { useUiAddonsSync } from '../api/use-ui-addons-sync';
import { INSTALLED_PATH, MARKETPLACE_PATH } from '../paths';

const TABS = [
  { to: INSTALLED_PATH, label: 'Installed' },
  { to: MARKETPLACE_PATH, label: 'Marketplace' },
] as const;

export function AddonManagerLayout() {
  // Mounted for both tabs, so a status change is noticed whichever tab is open (the pages share
  // this query and its polling).
  const api = useAddonsAdminApi();
  const installed = useQuery(installedAddonsQuery(api));
  const marketplace = useQuery(marketplaceAddonsQuery(api));
  const counts = {
    [INSTALLED_PATH]: installed.data?.length,
    [MARKETPLACE_PATH]: marketplace.data?.length,
  };
  const hasProblem = installed.data?.some(
    (addon) => addon.status === 'failed' || addon.status === 'partially_active',
  );
  useUiAddonsSync(installed.data);
  useInstallOutcomeToasts(installed.data);
  useReviewOutcomes();

  return (
    <div className="space-y-6">
      <PageHeader title="Addons" description="Installed addons and the marketplace." />
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
            {counts[tab.to] !== undefined ? (
              <span className="text-muted-foreground ml-1.5 text-xs font-normal tabular-nums">
                {counts[tab.to]}
              </span>
            ) : null}
            {tab.to === INSTALLED_PATH && hasProblem ? (
              <span className="ml-1.5 inline-flex align-middle">
                <StatusDot tone="warning" />
                <span className="sr-only">Some addons need attention</span>
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
