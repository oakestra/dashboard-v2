import type { Application } from '@oakestra/api';
import { useAddonPath } from '@oakestra/dashboard-sdk';
import { Button, QueryErrorAlert, SectionCard, Skeleton, StatusBadge, plural } from '@oakestra/ui';
import { ChevronRightIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApplicationFormDialog } from '../applications/components/ApplicationFormDialog';
import { describeServiceCounts, type ApplicationHealth } from '../applications/health';
import { newestFirst } from '../queries';
import { useOverviewData } from './data';
import { GettingStarted } from './GettingStarted';

const RECENT_APPLICATIONS = 5;

/**
 * Overview section (`home.widgets`, size `wide`): the newest applications, or the first steps for
 * someone who has none. Also where a failed load of the applications shows, since the tiles only
 * show numbers.
 */
export function RecentApplications() {
  const addonPath = useAddonPath();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { applications, healthById, applicationsLoading, error, retry } = useOverviewData();

  const dialog = (
    <ApplicationFormDialog
      open={creating}
      onOpenChange={setCreating}
      onSaved={(created) => {
        if (created) void navigate(addonPath(created._id));
      }}
    />
  );

  if (error) {
    return (
      <QueryErrorAlert title="Could not load your applications" error={error} onRetry={retry} />
    );
  }

  if (!applicationsLoading && applications.length === 0) {
    return (
      <>
        <GettingStarted onCreate={() => setCreating(true)} />
        {dialog}
      </>
    );
  }

  return (
    <>
      <SectionCard
        title="Recent applications"
        description="Your newest applications and how they are doing."
        action={
          <div className="flex flex-wrap gap-2">
            {applications.length > RECENT_APPLICATIONS ? (
              <Button variant="outline" size="sm" asChild>
                <Link to={addonPath()}>View all</Link>
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setCreating(true)} disabled={applicationsLoading}>
              <PlusIcon aria-hidden /> New application
            </Button>
          </div>
        }
        flush
        data-testid="recent-applications"
      >
        {applicationsLoading ? (
          <RecentApplicationsSkeleton />
        ) : (
          <ApplicationList
            applications={newestFirst(applications).slice(0, RECENT_APPLICATIONS)}
            healthById={healthById}
          />
        )}
      </SectionCard>
      {dialog}
    </>
  );
}

function RecentApplicationsSkeleton() {
  return (
    <ul className="divide-y border-t" aria-hidden>
      {[0, 1, 2].map((index) => (
        <li key={index} className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
          <span className="space-y-1.5">
            <Skeleton className="block h-4 w-36" />
            <Skeleton className="block h-3 w-52" />
          </span>
          <Skeleton className="h-5 w-20" />
        </li>
      ))}
    </ul>
  );
}

function ApplicationList({
  applications,
  healthById,
}: {
  applications: readonly Application[];
  healthById: ReadonlyMap<string, ApplicationHealth | undefined>;
}) {
  const addonPath = useAddonPath();
  return (
    <ul className="divide-y border-t">
      {applications.map((application) => {
        const health = healthById.get(application._id);
        return (
          <li key={application._id}>
            <Link
              to={addonPath(application._id)}
              className="group flex items-center gap-3 px-5 py-3 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 sm:px-6"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {application.application_name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {health
                    ? describeServiceCounts(health)
                    : plural(application.microservices.length, 'service')}
                  {application.application_desc ? ` - ${application.application_desc}` : ''}
                </span>
              </span>
              {health ? (
                <StatusBadge tone={health.tone} className="shrink-0">
                  {health.label}
                </StatusBadge>
              ) : null}
              <ChevronRightIcon
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
