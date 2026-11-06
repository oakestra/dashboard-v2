import type { Application, Cluster, Service } from '@oakestra/api';
import {
  allApplicationsQuery,
  allServicesQuery,
  applicationsQuery,
  clustersQuery,
  profileQuery,
  servicesByApplicationQuery,
  useCurrentUser,
  useOakestraApi,
  usePermissions,
} from '@oakestra/dashboard-sdk';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { FleetEntry, FleetScope } from './lib';

const REFRESH_MS = 10_000;

// `silent`: one failed round would otherwise toast once per query, per poll. The page renders a
// single banner instead.
const SILENT = { meta: { silent: true } };
const LIVE = { ...SILENT, refetchInterval: REFRESH_MS };

const NO_APPLICATIONS: readonly Application[] = [];
const NO_CLUSTERS: readonly Cluster[] = [];

interface QueryState {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  data: unknown;
  dataUpdatedAt: number;
  refetch: () => unknown;
}

function foldServices(results: UseQueryResult<Service[]>[]) {
  return { lists: results.map((query) => query.data), states: results as QueryState[] };
}

function byApplication(
  applications: readonly Application[],
  services: readonly Service[],
): FleetEntry[] {
  const grouped = new Map<string, Service[]>();
  for (const service of services) {
    if (service.applicationID === undefined) continue;
    const group = grouped.get(service.applicationID);
    if (group) group.push(service);
    else grouped.set(service.applicationID, [service]);
  }
  return applications.map((application) => ({
    application,
    services: grouped.get(application._id) ?? [],
  }));
}

export interface FleetData {
  scope: FleetScope;
  username: string | null;
  entries: readonly FleetEntry[];
  clusters: readonly Cluster[];
  /** `error` only when there is nothing to show; a failed poll over old data is `stale`. */
  status: 'pending' | 'error' | 'ready';
  error: Error | null;
  /** The last refresh failed, what is shown is older than it looks. */
  stale: boolean;
  /** When the oldest part of what is shown was fetched. */
  updatedAt: number;
  retry: () => void;
}

/**
 * Everything the fleet shows, whoever is looking. An Admin gets two lists covering the platform.
 * Everyone else only has endpoints for their own applications, and services per application, so
 * that takes the profile (for the `_id`) and one request per application.
 */
export function useFleetData(): FleetData {
  const api = useOakestraApi();
  const user = useCurrentUser();
  const isAdmin = usePermissions().hasRole('Admin');
  const username = user?.username ?? null;

  // Polls by itself, see `clustersQuery`.
  const clusters = useQuery({ ...clustersQuery(api), ...SILENT });

  const allApplications = useQuery({ ...allApplicationsQuery(api), ...LIVE, enabled: isAdmin });
  const allServices = useQuery({ ...allServicesQuery(api), ...LIVE, enabled: isAdmin });

  const profile = useQuery({
    ...profileQuery(api, username ?? ''),
    ...SILENT,
    enabled: !isAdmin && username !== null,
  });
  const userId = profile.data?._id;
  const ownApplications = useQuery({
    ...applicationsQuery(api, userId ?? ''),
    ...LIVE,
    enabled: !isAdmin && userId !== undefined,
  });
  const ownList = isAdmin ? NO_APPLICATIONS : (ownApplications.data ?? NO_APPLICATIONS);
  const own = useQueries({
    queries: ownList.map((application) => ({
      ...servicesByApplicationQuery(api, application._id),
      ...LIVE,
    })),
    combine: foldServices,
  });

  const entries = useMemo<readonly FleetEntry[]>(() => {
    if (isAdmin) return byApplication(allApplications.data ?? [], allServices.data ?? []);
    return ownList.map((application, index) => {
      const services = own.lists[index];
      return { application, services: services ?? [], servicesUnavailable: !services };
    });
  }, [isAdmin, allApplications.data, allServices.data, ownList, own.lists]);

  const required: QueryState[] = isAdmin
    ? [clusters, allApplications, allServices]
    : [clusters, profile, ownApplications];
  const optional = isAdmin ? [] : own.states;
  const all = [...required, ...optional];

  const failed = all.filter((query) => query.isError);
  const missing = required.find((query) => query.data === undefined && query.isError);
  const pending =
    required.some((query) => query.isPending) || optional.some((query) => query.isPending);

  return {
    scope: isAdmin ? 'all' : 'own',
    username,
    entries,
    clusters: clusters.data ?? NO_CLUSTERS,
    // Without the clusters every instance would look unplaced, so they are not optional.
    status: missing ? 'error' : pending ? 'pending' : 'ready',
    error: missing?.error ?? failed[0]?.error ?? null,
    stale: failed.length > 0,
    updatedAt: Math.min(...all.map((query) => query.dataUpdatedAt).filter((time) => time > 0)),
    retry: () => failed.forEach((query) => void query.refetch()),
  };
}
