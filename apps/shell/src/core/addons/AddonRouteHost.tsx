import type { AddonRoute } from '@oakestra/dashboard-sdk';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@oakestra/ui';
import { useMemo, type ReactNode } from 'react';
import { useParams, useRoutes, type RouteObject } from 'react-router';
import { useStore } from 'zustand';

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
        <AddonMessage title="Addon disabled" testId="addon-disabled">
          The addon “{addonId}” has been disabled or uninstalled.
        </AddonMessage>
      );
    }
    if (availability === 'pending') return <AddonPageSkeleton />;
    if (availability === 'unavailable') {
      return (
        <AddonMessage title="Addons unavailable" testId="addons-unavailable">
          The addons service cannot be reached right now.
        </AddonMessage>
      );
    }
    return (
      <AddonMessage title="Addon not found" testId="addon-not-found">
        There is no active addon called “{addonId}”.
      </AddonMessage>
    );
  }

  switch (entry.state) {
    case 'loading':
      return <AddonPageSkeleton />;
    case 'failed':
      return (
        <AddonMessage title="Addon failed to load" testId="addon-failed">
          {entry.error}
        </AddonMessage>
      );
    case 'incompatible':
      return (
        <AddonMessage title="Addon not compatible" testId="addon-incompatible">
          {entry.error}
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
    <AddonMessage title="Page not found" testId="addon-page-not-found">
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

function AddonMessage({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <Card className="max-w-xl" data-testid={testId}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
