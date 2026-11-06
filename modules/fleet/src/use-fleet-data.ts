import type { Application, Cluster, Service } from '@oakestra/api';
import {
  allApplicationsQuery,
  allServicesQuery,
  addonQueryKey,
  applicationsQuery,
  clustersQuery,
  profileQuery,
  servicesByApplicationQuery,
  useCurrentUser,
  useOakestraApi,
  usePermissions,
  type OakestraApi,
} from '@oakestra/dashboard-sdk';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
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

interface ServicesResult {
  applicationId: string;
  /** The last list that arrived, which a failed refresh leaves in place. */
  services: Service[] | undefined;
  updatedAt: number;
  error: Error | null;
}

/**
 * One round over all applications. A timer per application would land its responses one by one, and
 * each would rebuild the whole fleet. The lists still go through their shared cache entries, and a
 * failure stays with its application.
 */
function refreshServices(
  queryClient: QueryClient,
  api: OakestraApi,
  applications: readonly Application[],
): Promise<ServicesResult[]> {
  return Promise.all(
    applications.map(async ({ _id }) => {
      const options = servicesByApplicationQuery(api, _id);
      const error = await queryClient.fetchQuery({ ...options, ...SILENT, staleTime: 0 }).then(
        () => null,
        (reason: Error) => reason,
      );
      const state = queryClient.getQueryState(options.queryKey);
      return {
        applicationId: _id,
        services: state?.data,
        updatedAt: state?.dataUpdatedAt ?? 0,
        error,
      };
    }),
  );
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
  const queryClient = useQueryClient();
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
  const own = useQuery({
    queryKey: addonQueryKey('fleet', 'own-services', ...ownList.map(({ _id }) => _id)),
    queryFn: () => refreshServices(queryClient, api, ownList),
    ...LIVE,
    enabled: !isAdmin && ownApplications.data !== undefined,
    // Mutations invalidate the lists, not this key, so coming back to the page always refreshes.
    staleTime: 0,
    // Each list was already shared in its own cache entry.
    structuralSharing: false,
  });

  const entries = useMemo<readonly FleetEntry[]>(() => {
    if (isAdmin) return byApplication(allApplications.data ?? [], allServices.data ?? []);
    const results = new Map(own.data?.map((result) => [result.applicationId, result]));
    return ownList.map((application) => {
      const services = results.get(application._id)?.services;
      return { application, services: services ?? [], servicesUnavailable: !services };
    });
  }, [isAdmin, allApplications.data, allServices.data, ownList, own.data]);

  const required: QueryState[] = isAdmin
    ? [clusters, allApplications, allServices]
    : [clusters, profile, ownApplications];
  const ownResults = isAdmin ? [] : (own.data ?? []);
  const ownError = ownResults.find((result) => result.error)?.error ?? null;

  const failed = required.filter((query) => query.isError);
  const missing = required.find((query) => query.data === undefined && query.isError);
  const pending = required.some((query) => query.isPending) || (!isAdmin && own.isPending);
  const updates = [
    ...required.map((query) => query.dataUpdatedAt),
    ...ownResults.map((r) => r.updatedAt),
  ];

  return {
    scope: isAdmin ? 'all' : 'own',
    username,
    entries,
    clusters: clusters.data ?? NO_CLUSTERS,
    // Without the clusters every instance would look unplaced, so they are not optional.
    status: missing ? 'error' : pending ? 'pending' : 'ready',
    error: missing?.error ?? failed[0]?.error ?? ownError,
    stale: failed.length > 0 || ownError !== null,
    updatedAt: Math.min(...updates.filter((time) => time > 0)),
    retry: () => {
      failed.forEach((query) => void query.refetch());
      if (ownError) void own.refetch();
    },
  };
}
