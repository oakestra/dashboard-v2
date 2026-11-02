import { Alert, AlertDescription, AlertTitle, Button } from '@oakestra/ui';
import type { ComponentProps, ReactNode } from 'react';

import { describeError } from '../core/api/errors';

interface QueryErrorAlertProps extends Omit<ComponentProps<typeof Alert>, 'title' | 'children'> {
  title: ReactNode;
  error: unknown;
  onRetry: () => void;
  /** Extra text after the error message, e.g. that the data below may be out of date. */
  children?: ReactNode;
}

/** Inline error state for a failed query, with a retry button. */
export function QueryErrorAlert({
  title,
  error,
  onRetry,
  children,
  ...props
}: QueryErrorAlertProps) {
  return (
    <Alert variant="destructive" {...props}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>
          {describeError(error)}
          {children}
        </p>
        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
