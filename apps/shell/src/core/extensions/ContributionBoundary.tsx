import { AddonContext } from '@oakestra/dashboard-sdk';
import { Skeleton } from '@oakestra/ui';
import { TriangleAlertIcon } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';

import { ErrorBoundary } from './ErrorBoundary';
import type { ContributionSource } from './registry';

interface ContributionBoundaryProps {
  source: ContributionSource;
  /** What failed, for the error message, e.g. "Widget Jobs". */
  label: string;
  children: ReactNode;
  fallback?: ReactNode;
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
}: ContributionBoundaryProps) {
  const content = (
    <ErrorBoundary
      fallback={(error) => <ContributionError source={source} label={label} error={error} />}
      onError={(error) => console.error(`[${source.kind}:${source.id}] ${label} crashed`, error)}
    >
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );

  if (source.kind !== 'addon') return content;
  return <AddonContext.Provider value={source.addon}>{content}</AddonContext.Provider>;
}

function ContributionError({
  source,
  label,
  error,
}: {
  source: ContributionSource;
  label: string;
  error: Error;
}) {
  return (
    <div
      role="alert"
      data-testid="contribution-error"
      data-source={`${source.kind}:${source.id}`}
      className="border-destructive/40 flex gap-2 rounded-lg border px-4 py-3 text-sm"
    >
      <TriangleAlertIcon className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-destructive font-medium">
          {label} from {source.label} failed to render.
        </p>
        <p className="text-muted-foreground mt-1 break-words">{error.message}</p>
      </div>
    </div>
  );
}
