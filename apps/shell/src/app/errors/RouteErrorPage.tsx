import { Button } from '@oakestra/ui';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { describeError } from '../../core/api/errors';

function describe(error: unknown): { title: string; message: string; retry: boolean } {
  if (isRouteErrorResponse(error)) {
    const detail = typeof error.data === 'string' && error.data ? error.data : error.statusText;
    if (error.status === 403) {
      return {
        title: 'Access denied',
        message: detail || 'You cannot view this page.',
        retry: false,
      };
    }
    if (error.status === 404) {
      return {
        title: 'Page not found',
        message: detail || 'This page does not exist.',
        retry: false,
      };
    }
    return { title: 'Something went wrong', message: `${error.status} ${detail}`, retry: true };
  }
  return { title: 'Something went wrong', message: describeError(error), retry: true };
}

export function RouteErrorPage() {
  const { title, message, retry } = describe(useRouteError());

  return (
    <div role="alert" className="mx-auto max-w-xl space-y-4 p-8" data-testid="route-error">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground break-words">{message}</p>
      <div className="flex gap-2">
        {retry ? <Button onClick={() => window.location.reload()}>Reload</Button> : null}
        <Button asChild variant="outline">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
