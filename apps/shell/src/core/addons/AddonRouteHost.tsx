import { Button, EmptyState, Skeleton } from '@oakestra/ui';
import { CloudOffIcon, PowerOffIcon, PuzzleIcon, TriangleAlertIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useParams, useRoutes } from 'react-router';
import { useStore } from 'zustand';

import { useModuleEnabled } from '../modules';
import { ContributionBoundary } from '../extensions/ContributionBoundary';
import { addonLabel, type AddonEntry } from './addon-registry';
import { useAddonRegistry } from './addon-registry-context';
import { AddonForbiddenContext, addonRouteObjects, useSessionUser } from './addon-routes';
import { addonBasePath, addonSource } from './ui-addons';

interface AddonRouteHostProps {
  forbidden: ReactNode;
  /** Renders this addon instead of the one named by the `:addonId` param (mount routes). */
  addonId?: string;
}

/**
 * Renders `/addons/:addonId/*`, or the mount of one preset addon when `addonId` is given. Addon
 * routes are resolved here with useRoutes instead of being patched into the data router, so addons
 * can come and go at runtime and every state (still loading, failed, removed) gets its own page
 * instead of a router 404.
 *
 * The registry entry is checked before the addons manager's availability: preset addons do not
 * depend on it and render while it is down or switched off.
 */
export function AddonRouteHost({ forbidden, addonId: fixedId }: AddonRouteHostProps) {
  const params = useParams();
  const { pathname, search, hash } = useLocation();
  const addonId = fixedId ?? params.addonId ?? '';
  const registry = useAddonRegistry();
  const entry = useStore(registry, (state) => state.entries[addonId]);
  const wasRemoved = useStore(registry, (state) => state.removed[addonId] === true);
  const availability = useStore(registry, (state) => state.availability);

  if (!entry) {
    if (wasRemoved) {
      return (
        <AddonMessage title="Addon disabled" testId="addon-disabled" icon={<PowerOffIcon />}>
          The addon "{addonId}" has been disabled or uninstalled.
        </AddonMessage>
      );
    }
    if (availability === 'pending') return <AddonPageSkeleton />;
    // With discovery off an unknown addon is just unknown: there is no service to blame.
    if (availability === 'unavailable') {
      return (
        <AddonMessage
          title="Addons unavailable"
          testId="addons-unavailable"
          icon={<CloudOffIcon />}
        >
          The addons service cannot be reached right now.
        </AddonMessage>
      );
    }
    return (
      <AddonMessage
        title={`No dashboard UI for "${addonId}"`}
        testId="addon-not-found"
        icon={<PuzzleIcon />}
      >
        This addon is not active or does not ship a dashboard page.
      </AddonMessage>
    );
  }

  // A mounted addon has one canonical address. Its nav links already point there, but old
  // bookmarks and hand-typed /addons/<name> URLs would otherwise render a second copy of the pages
  // whose links (useAddonPath) lead to the mount anyway.
  if (fixedId === undefined && entry.basePath !== addonBasePath(addonId)) {
    // From the raw pathname: the decoded splat would turn an encoded %2F, %3F or %23 into a
    // segment, a query or a hash.
    const rest = pathname.replace(/^\/addons\/[^/]*/i, '').replace(/\/$/, '');
    return <Navigate to={`${entry.basePath}${rest}${search}${hash}`} replace />;
  }

  switch (entry.state) {
    case 'loading':
      return <AddonPageSkeleton />;
    case 'failed':
      return (
        <AddonMessage
          title="Addon failed to load"
          testId="addon-failed"
          icon={<TriangleAlertIcon />}
          detail={entry.error}
        >
          The dashboard UI of "{entry.name}" could not be loaded.
        </AddonMessage>
      );
    case 'incompatible':
      return (
        <AddonMessage
          title="Addon not compatible"
          testId="addon-incompatible"
          icon={<TriangleAlertIcon />}
          detail={entry.error}
        >
          "{entry.name}" was built for another version of this dashboard.
        </AddonMessage>
      );
    case 'loaded':
      return (
        <AddonForbiddenContext.Provider value={forbidden}>
          <LoadedAddonRoutes key={`${entry.name}@${entry.version}`} entry={entry} />
        </AddonForbiddenContext.Provider>
      );
  }
}

function LoadedAddonRoutes({ entry }: { entry: Extract<AddonEntry, { state: 'loaded' }> }) {
  const routes = useMemo(
    () => [
      ...addonRouteObjects(entry.definition.routes ?? []),
      { path: '*', element: <AddonPageNotFound label={addonLabel(entry)} /> },
    ],
    [entry],
  );
  const source = useMemo(() => addonSource(entry), [entry]);
  const element = useRoutes(routes);

  return (
    <ContributionBoundary source={source} label="Page" fallback={<AddonPageSkeleton />}>
      {element}
    </ContributionBoundary>
  );
}

function AddonPageNotFound({ label }: { label: string }) {
  return (
    <AddonMessage title="Page not found" testId="addon-page-not-found" icon={<PuzzleIcon />}>
      {label} has no page at this address.
    </AddonMessage>
  );
}

function AddonPageSkeleton() {
  return (
    <div className="space-y-4" data-testid="addon-loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function AddonMessage({
  title,
  testId,
  icon,
  detail,
  children,
}: {
  title: string;
  testId: string;
  icon: ReactNode;
  /** Technical reason (error text), kept apart from the sentence so it can be copied. */
  detail?: string;
  children?: ReactNode;
}) {
  const isAdmin = useSessionUser()?.roles.includes('Admin') ?? false;
  const hasAddonManager = useModuleEnabled('addon-manager');
  const canManage = isAdmin && hasAddonManager;
  return (
    <EmptyState
      data-testid={testId}
      className="mx-auto max-w-xl py-16"
      icon={icon}
      title={title}
      description={
        <>
          {children}
          {detail ? (
            <code className="bg-muted text-muted-foreground mt-3 block rounded-md px-3 py-2 text-left font-mono text-xs break-words whitespace-pre-wrap">
              {detail}
            </code>
          ) : null}
        </>
      }
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {/* Not "overview": `/` leads to the preset's start page, which may be another one. */}
          <Button asChild variant="outline">
            <Link to="/">Back to start</Link>
          </Button>
          {canManage ? (
            <Button asChild variant="outline">
              <Link to="/addon-manager/installed">Manage addons</Link>
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
