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

function forbidden(message: string): Described {
  return { title: 'Access denied', message, retry: false, icon: <LockIcon /> };
}

function describe(error: unknown): Described {
  if (isRouteErrorResponse(error)) {
    const detail = typeof error.data === 'string' && error.data ? error.data : error.statusText;
    if (error.status === 403) return forbidden(detail || 'You cannot view this page.');
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
  return <ErrorView {...describe(useRouteError())} />;
}

/**
 * The 403 page of `requireRole`, for places that deny access while rendering instead of in a
 * loader: role-restricted addon routes, which the data router never sees.
 */
export function ForbiddenPage({ message }: { message: string }) {
  return <ErrorView {...forbidden(message)} />;
}

function ErrorView({ title, message, retry, icon }: Described) {
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
            <Button size="sm" onClick={() => window.location.reload()}>
              <RotateCwIcon aria-hidden />
              Reload
            </Button>
          ) : null}
          <Button asChild size="sm" variant={retry ? 'outline' : 'default'}>
            <Link to="/">Back to home</Link>
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </ErrorState>
  );
}
