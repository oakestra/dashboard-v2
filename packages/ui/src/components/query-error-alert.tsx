import type { ComponentProps, ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from './alert';
import { Button } from './button';

// Mirrors `describeError` from @oakestra/api, which this package cannot depend on. ApiError
// messages are already written for people and ApiError extends Error, so reading `message` gives
// the same text.
function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong.';
}

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
          {messageOf(error)}
          {children}
        </p>
        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
