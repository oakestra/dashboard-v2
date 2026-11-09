import { AddonContext } from '@oakestra/dashboard-sdk';
import { Button, Skeleton, cn } from '@oakestra/ui';
import { TriangleAlertIcon } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';

import { isChunkLoadError } from './chunk-load-error';
import { ErrorBoundary } from './ErrorBoundary';
import type { ContributionSource } from './registry';

interface ContributionBoundaryProps {
  source: ContributionSource;
  /** What failed, for the error message, e.g. "Widget Jobs". */
  label: string;
  children: ReactNode;
  fallback?: ReactNode;
  /** The contribution is a whole page, so its error state fills the page instead of a box. */
  page?: boolean;
  /** A change clears the error state, see ErrorBoundary. */
  resetKey?: unknown;
  /**
   * Renders nothing instead of the error message, for contributions too small to hold one (a nav
   * badge). The error is still logged.
   */
  quiet?: boolean;
}

/**
 * Isolates one contribution: a render error or a suspended lazy component only affects this box.
 * For addon contributions it also provides the AddonContext, so SDK hooks like useAddonBasePath()
 * know which addon they run in.
 */
export function ContributionBoundary({
  source,
  label,
  children,
  fallback = <Skeleton className="h-24 w-full" />,
  page = false,
  resetKey,
  quiet = false,
}: ContributionBoundaryProps) {
  const content = (
    <ErrorBoundary
      fallback={(error, reset) =>
        quiet ? null : (
          <ContributionError
            source={source}
            label={label}
            error={error}
            page={page}
            onReload={reset}
          />
        )
      }
      onError={(error) => console.error(`[${source.kind}:${source.id}] ${label} crashed`, error)}
      resetKey={resetKey}
    >
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );

  if (source.kind !== 'addon') return content;
  return <AddonContext.Provider value={source.addon}>{content}</AddonContext.Provider>;
}

/**
 * Has no frame of its own: it renders inside cards, tab panels and on the bare page alike, and
 * whoever hosts the contribution decides what surrounds it.
 */
function ContributionError({
  source,
  label,
  error,
  page,
  onReload,
}: {
  source: ContributionSource;
  label: string;
  error: Error;
  page: boolean;
  onReload: () => void;
}) {
  const needsPageReload = isChunkLoadError(error);
  return (
    <div
      role="alert"
      data-testid="contribution-error"
      data-slot="contribution-error"
      data-source={`${source.kind}:${source.id}`}
      className={cn('flex min-w-0 gap-2.5 text-sm', page && 'mx-auto max-w-xl py-16')}
    >
      <TriangleAlertIcon className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {label} from {source.label} failed to render.
        </p>
        <p className="text-muted-foreground mt-1">
          {needsPageReload
            ? 'Its code could not be downloaded, so the whole page has to reload.'
            : `The rest of ${page ? 'the dashboard' : 'this page'} keeps working.`}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          {needsPageReload ? (
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          ) : (
            <Button size="sm" variant="outline" aria-label={`Reload ${label}`} onClick={onReload}>
              Reload
            </Button>
          )}
          {error.message ? (
            // Native on purpose: the text stays in the DOM, so it can be found and selected.
            <details className="text-muted-foreground min-w-0 text-xs open:basis-full">
              <summary className="hover:text-foreground focus-visible:ring-ring w-fit cursor-pointer rounded-sm outline-none focus-visible:ring-2">
                Error details
              </summary>
              <code className="bg-muted mt-2 block rounded-md px-3 py-2 font-mono break-words whitespace-pre-wrap">
                {error.message}
              </code>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
