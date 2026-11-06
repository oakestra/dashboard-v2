import { useAddonPath, useCurrentUser } from '@oakestra/dashboard-sdk';
import { Alert, AlertDescription, PageHeader, Skeleton, QueryErrorAlert } from '@oakestra/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { isNotFound, NotFound } from '../../components/NotFound';

/**
 * Header plus loading and error states for the queries a form page needs first. `children` gets
 * the session's organization, which every SLA needs as its `customerID`. A query answering 404
 * (an id in the URL that names nothing) shows `notFound` instead of the page.
 */
export function PageFrame({
  title,
  description,
  queries,
  notFound,
  children,
}: {
  title: string;
  description: ReactNode;
  queries: UseQueryResult[];
  /** `back` are the segments below the mount the not-found state links to. */
  notFound: { title: string; back: string[]; backLabel: string };
  children: (customerId: string) => ReactNode;
}) {
  const addonPath = useAddonPath();
  const customerId = useCurrentUser()?.organization ?? null;
  const failed = queries.find((query) => query.isError);
  if (failed && isNotFound(failed.error)) {
    return (
      <NotFound
        title={notFound.title}
        description="It may have been deleted."
        back={addonPath(...notFound.back)}
        backLabel={notFound.backLabel}
      />
    );
  }
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} />
      {failed ? (
        <QueryErrorAlert
          title="Could not load the data for this form"
          error={failed.error}
          onRetry={() => queries.forEach((query) => void query.refetch())}
        />
      ) : queries.some((query) => query.isPending) ? (
        <div className="space-y-4" data-testid="sla-loading">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : customerId ? (
        children(customerId)
      ) : (
        <Alert variant="destructive">
          <AlertDescription>
            Your session has no organization, so a service cannot be created.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
