import { Alert, AlertDescription, AlertTitle, Button, PageHeader, Skeleton } from '@oakestra/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { describeError } from '../../../core/api/errors';

/** Header plus loading and error states for the queries a form page needs first. */
export function PageFrame({
  title,
  description,
  queries,
  children,
}: {
  title: string;
  description: ReactNode;
  queries: UseQueryResult[];
  children: ReactNode;
}) {
  const failed = queries.find((query) => query.isError);
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      {failed ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load the data for this form</AlertTitle>
          <AlertDescription>
            <p>{describeError(failed.error)}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => queries.forEach((query) => void query.refetch())}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : queries.some((query) => query.isPending) ? (
        <div className="space-y-4" data-testid="sla-loading">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}
