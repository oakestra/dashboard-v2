import { SectionCard, Skeleton } from '@oakestra/ui';
import { CircleCheckIcon, ChevronRightIcon } from 'lucide-react';
import { Link } from 'react-router';

import { StatusBadge } from '../../services';
import type { AttentionItem } from '../attention';

const MAX_ROWS = 5;

interface NeedsAttentionProps {
  items: readonly AttentionItem[];
  /** Services exist and have all been looked at; without any there is nothing to report. */
  hasServices: boolean;
  loading: boolean;
}

export function NeedsAttention({ items, hasServices, loading }: NeedsAttentionProps) {
  if (!loading && items.length === 0 && !hasServices) return null;

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
        <div className="space-y-3 border-t px-5 py-4 sm:px-6">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 border-t px-5 py-4 text-sm text-muted-foreground sm:px-6">
          <CircleCheckIcon aria-hidden className="size-4 text-success" />
          All services are running or on their way.
        </p>
      ) : (
        <ul className="divide-y border-t">
          {shown.map((item) => (
            <li key={item.key}>
              <Link
                to={`/applications/${item.applicationId}/services/${item.service._id}`}
                className="group flex items-center gap-3 px-5 py-3 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 sm:px-6"
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
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
          {hidden > 0 ? (
            <li className="px-5 py-3 text-xs text-muted-foreground sm:px-6">
              and {hidden} more, open an application to see them
            </li>
          ) : null}
        </ul>
      )}
    </SectionCard>
  );
}
