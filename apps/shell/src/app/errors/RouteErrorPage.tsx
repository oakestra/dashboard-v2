import { Button } from '@oakestra/ui';
import { LockIcon, RotateCwIcon, SearchXIcon, TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { describeError } from '../../core/api/errors';
import { ErrorState } from './ErrorState';

interface Described {
  title: string;
  message: string;
  retry: boolean;
  icon: ReactNode;
}

function describe(error: unknown): Described {
  if (isRouteErrorResponse(error)) {
    const detail = typeof error.data === 'string' && error.data ? error.data : error.statusText;
    if (error.status === 403) {
      return {
        title: 'Access denied',
        message: detail || 'You cannot view this page.',
        retry: false,
        icon: <LockIcon />,
      };
    }
    if (error.status === 404) {
      return {
        title: 'Page not found',
        message: detail || 'This page does not exist.',
        retry: false,
        icon: <SearchXIcon />,
      };
    }
    return {
      title: 'Something went wrong',
      message: `${error.status} ${detail}`,
      retry: true,
      icon: <TriangleAlertIcon />,
    };
  }
  return {
    title: 'Something went wrong',
    message: describeError(error),
    retry: true,
    icon: <TriangleAlertIcon />,
  };
}

export function RouteErrorPage() {
  const { title, message, retry, icon } = describe(useRouteError());

  return (
    <ErrorState
      role="alert"
      data-testid="route-error"
      icon={icon}
      tone={retry ? 'destructive' : 'neutral'}
      title={title}
      actions={
        <>
          {retry ? (
            <Button onClick={() => window.location.reload()}>
              <RotateCwIcon aria-hidden />
              Reload
            </Button>
          ) : null}
          <Button asChild variant={retry ? 'outline' : 'default'}>
            <Link to="/">Back to home</Link>
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </ErrorState>
  );
}
