import type { AddonRoute } from '@oakestra/dashboard-sdk';
import { Button, EmptyState, Skeleton } from '@oakestra/ui';
import { CloudOffIcon, PowerOffIcon, PuzzleIcon, TriangleAlertIcon } from 'lucide-react';
import { useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useParams, useRoutes, type RouteObject } from 'react-router';
import { useStore } from 'zustand';

import { AuthSessionContext } from '../auth/auth-context';
import { ContributionBoundary } from '../extensions/ContributionBoundary';
import type { AddonEntry } from './addon-registry';
import { useAddonRegistry } from './addon-registry-context';
import { addonBasePath } from './ui-addons';

/**
 * Renders `/addons/:addonId/*`. Addon routes are resolved here with useRoutes instead of being
 * patched into the data router, so addons can come and go at runtime and every state (still
 * loading, failed, removed) gets a proper page instead of a router 404.
 */
export function AddonRouteHost() {
  const { addonId = '' } = useParams();
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
      return <LoadedAddonRoutes key={`${entry.name}@${entry.version}`} entry={entry} />;
  }
}

function LoadedAddonRoutes({ entry }: { entry: Extract<AddonEntry, { state: 'loaded' }> }) {
  const routes = useMemo(
    () => [
      ...(entry.definition.routes ?? []).map(toRouteObject),
      { path: '*', Component: AddonPageNotFound },
    ],
    [entry.definition],
  );
  const element = useRoutes(routes);

  return (
    <ContributionBoundary
      source={{
        kind: 'addon',
        id: entry.name,
        label: `addon "${entry.name}"`,
        addon: { addonId: entry.name, version: entry.version, basePath: addonBasePath(entry.name) },
      }}
      label="Page"
      fallback={<AddonPageSkeleton />}
    >
      {element}
    </ContributionBoundary>
  );
}

function toRouteObject(route: AddonRoute): RouteObject {
  const children = route.children?.map(toRouteObject);
  if (route.index) return { index: true, Component: route.Component ?? null };
  return {
    ...(route.path !== undefined ? { path: route.path } : {}),
    Component: route.Component ?? null,
    ...(children ? { children } : {}),
  };
}

function AddonPageNotFound() {
  return (
    <AddonMessage title="Page not found" testId="addon-page-not-found" icon={<PuzzleIcon />}>
      This addon has no page at this address.
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

const noSubscription = () => () => {};

/** Reads the session straight from its store, so the host also renders without an auth provider. */
function useIsAdmin(): boolean {
  const session = useContext(AuthSessionContext);
  return useSyncExternalStore(
    session ? session.store.subscribe : noSubscription,
    () => session?.store.getState().user?.roles.includes('Admin') ?? false,
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
  const isAdmin = useIsAdmin();
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
          <Button asChild variant="outline">
            <Link to="/">Back to overview</Link>
          </Button>
          {isAdmin ? (
            <Button asChild variant="outline">
              <Link to="/addon-manager/installed">Manage addons</Link>
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
