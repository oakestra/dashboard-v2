import { useCurrentUser } from '@oakestra/dashboard-sdk';
import { Alert, AlertDescription, PageHeader, Skeleton } from '@oakestra/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { QueryErrorAlert } from '../../../components/QueryErrorAlert';

/**
 * Header plus loading and error states for the queries a form page needs first. `children` gets
 * the session's organization, which every SLA needs as its `customerID`.
 */
export function PageFrame({
  title,
  description,
  queries,
  children,
}: {
  title: string;
  description: ReactNode;
  queries: UseQueryResult[];
  children: (customerId: string) => ReactNode;
}) {
  const customerId = useCurrentUser()?.organization ?? null;
  const failed = queries.find((query) => query.isError);
  return (
    <div className="space-y-6">
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
