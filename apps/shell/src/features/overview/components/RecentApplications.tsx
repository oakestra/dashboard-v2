import { Skeleton, StatusBadge } from '@oakestra/ui';
import { ChevronRightIcon } from 'lucide-react';
import type { Application } from '@oakestra/api';
import { Link } from 'react-router';

import { plural } from '../../../lib/format';
import { describeServiceCounts, type ApplicationHealth } from '../../applications';

interface RecentApplicationsProps {
  applications: readonly Application[];
  /** Undefined for an application whose services are still loading. */
  healthById: ReadonlyMap<string, ApplicationHealth | undefined>;
}

export function RecentApplicationsSkeleton() {
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

export function RecentApplications({ applications, healthById }: RecentApplicationsProps) {
  return (
    <ul className="divide-y border-t">
      {applications.map((application) => {
        const health = healthById.get(application._id);
        return (
          <li key={application._id}>
            <Link
              to={`/applications/${application._id}`}
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
