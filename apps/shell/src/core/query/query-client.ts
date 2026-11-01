import { isApiError } from '@oakestra/api';
import type { Notify } from '@oakestra/dashboard-sdk';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { describeError, isSessionError } from '../api/errors';

export interface ShellQueryMeta extends Record<string, unknown> {
  /** No toast for this query's errors, e.g. polls whose failure is an expected state. */
  silent?: boolean;
  /** Toast title when a background refetch fails; the error itself becomes the description. */
  errorMessage?: string;
}

export interface ShellMutationMeta extends Record<string, unknown> {
  /** No toast; the component shows the error itself (forms that render errors inline). */
  silent?: boolean;
  /** Toast title, e.g. "Could not update the email address". Defaults to a generic one. */
  errorMessage?: string;
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: ShellQueryMeta;
    mutationMeta: ShellMutationMeta;
  }
}

/** Client errors will not fix themselves on a retry; network and server errors might. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

/**
 * Error handling policy:
 * - Mutations toast every failure unless `meta.silent`.
 * - Queries toast only when a refetch fails while data is already on screen. A query without data
 *   renders its error inline, and a toast on top would say the same thing twice.
 * - Session errors (401 after the refresh attempt) never toast: the logout already explained it.
 */
export function createQueryClient(notify: Notify): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError(error, query) {
        if (query.meta?.silent || isSessionError(error)) return;
        if (query.state.data === undefined) return;
        notify.error(query.meta?.errorMessage ?? 'Could not refresh the data on this page', {
          description: describeError(error),
          id: `query-error:${query.queryHash}`,
        });
      },
    }),
    mutationCache: new MutationCache({
      onError(error, _variables, _context, mutation) {
        if (mutation.meta?.silent || isSessionError(error)) return;
        notify.error(mutation.meta?.errorMessage ?? 'The action failed', {
          description: describeError(error),
        });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
