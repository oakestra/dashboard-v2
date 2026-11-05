import { useAddonPath } from '@oakestra/dashboard-sdk';
import { SectionCard, Skeleton } from '@oakestra/ui';
import { CircleCheckIcon, ChevronRightIcon } from 'lucide-react';
import { Link } from 'react-router';

import { StatusBadge } from '../services/components/StatusBadge';
import { useOverviewData } from './data';

const MAX_ROWS = 5;

/** Overview section (`home.widgets`, size `wide`) listing the services a person has to look at. */
export function NeedsAttention() {
  const addonPath = useAddonPath();
  const {
    applications,
    services,
    attention: items,
    servicesLoading: loading,
    error,
  } = useOverviewData();
  // Nothing to look at: no applications (the getting-started card speaks for itself), a load
  // error (the recent applications section shows it), or no services at all.
  if (error || applications.length === 0) return null;
  if (!loading && items.length === 0 && services.length === 0) return null;

  const shown = items.slice(0, MAX_ROWS);
  const hidden = items.length - shown.length;

  return (
    <SectionCard
      title="Needs attention"
      description="Services that failed, cannot be scheduled or are not deployed yet."
      flush
      data-testid="needs-attention"
    >
      {loading ? (
        <div className="space-y-3 border-t px-4 py-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
          <CircleCheckIcon aria-hidden className="size-4 text-success" />
          All services are running or on their way.
        </p>
      ) : (
        <ul className="divide-y border-t">
          {shown.map((item) => (
            <li key={item.key}>
              <Link
                to={addonPath(item.applicationId, 'services', item.service._id)}
                className="group flex items-center gap-3 px-4 py-2 outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
              >
                <span className="w-28 shrink-0">
                  <StatusBadge status={item.status} detail={item.detail} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    <span className="text-muted-foreground">{item.applicationName} / </span>
                    {item.service.microservice_name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{item.note}</span>
                </span>
                <ChevronRightIcon
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground/60 group-hover:text-foreground"
                />
              </Link>
            </li>
          ))}
          {hidden > 0 ? (
            <li className="px-4 py-2 text-xs text-muted-foreground">
              and {hidden} more, open an application to see them
            </li>
          ) : null}
        </ul>
      )}
    </SectionCard>
  );
}
