import type { Application, Cluster, Service } from '@oakestra/api';
import {
  addonQueryKey,
  applicationsQuery,
  clustersQuery,
  profileQuery,
  servicesByApplicationQuery,
  useCurrentUser,
  useOakestraApi,
  type OakestraApi,
} from '@oakestra/dashboard-sdk';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { BoardEntry } from './lib';

const REFRESH_MS = 10_000;

// `silent`: one failed round would otherwise toast once per query, per poll. The board renders a
// single banner instead.
const SILENT = { meta: { silent: true } };
const LIVE = { ...SILENT, refetchInterval: REFRESH_MS };

const NO_APPLICATIONS: readonly Application[] = [];
const NO_CLUSTERS: readonly Cluster[] = [];

interface ServicesResult {
  applicationId: string;
  /** The last list that arrived, which a failed refresh leaves in place. */
  services: Service[] | undefined;
  updatedAt: number;
  error: Error | null;
}

/**
 * One round over all applications. A timer per application would land its responses one by one, and
 * each would rebuild the whole board. The lists still go through their shared cache entries, and a
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

export interface BoardData {
  entries: readonly BoardEntry[];
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
 * The current user's applications with their services, and every cluster, refreshed together. The
 * applications come from the same queries as `useMyApplications` (the profile for the `_id`, then
 * the per-user list), so both views share their cache entries; the services take one request per
 * application, because there is no per-user list of them.
 */
export function useBoardData(): BoardData {
  const api = useOakestraApi();
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const username = user?.username ?? null;

  // Polls by itself, see `clustersQuery`.
  const clusters = useQuery({ ...clustersQuery(api), ...SILENT });

  const profile = useQuery({
    ...profileQuery(api, username ?? ''),
    ...SILENT,
    enabled: username !== null,
  });
  const userId = profile.data?._id;
  const applications = useQuery({
    ...applicationsQuery(api, userId ?? ''),
    ...LIVE,
    enabled: userId !== undefined,
  });
  const list = applications.data ?? NO_APPLICATIONS;
  const services = useQuery({
    queryKey: addonQueryKey('applications', 'board-services', ...list.map(({ _id }) => _id)),
    queryFn: () => refreshServices(queryClient, api, list),
    ...LIVE,
    enabled: applications.data !== undefined,
    // Mutations invalidate the lists, not this key, so coming back to the board always refreshes.
    staleTime: 0,
    // Each list was already shared in its own cache entry.
    structuralSharing: false,
  });

  const entries = useMemo<readonly BoardEntry[]>(() => {
    const results = new Map(services.data?.map((result) => [result.applicationId, result]));
    return list.map((application) => {
      const found = results.get(application._id)?.services;
      return { application, services: found ?? [], servicesUnavailable: !found };
    });
  }, [list, services.data]);

  const required = [clusters, profile, applications];
  const results = services.data ?? [];
  const servicesError = results.find((result) => result.error)?.error ?? null;

  const failed = required.filter((query) => query.isError);
  const missing = required.find((query) => query.data === undefined && query.isError);
  const pending = required.some((query) => query.isPending) || services.isPending;
  const updates = [
    ...required.map((query) => query.dataUpdatedAt),
    ...results.map((result) => result.updatedAt),
  ];

  return {
    entries,
    clusters: clusters.data ?? NO_CLUSTERS,
    // Without the clusters every instance would look unplaced, so they are not optional.
    status: missing ? 'error' : pending ? 'pending' : 'ready',
    error: missing?.error ?? failed[0]?.error ?? servicesError,
    stale: failed.length > 0 || servicesError !== null,
    updatedAt: Math.min(...updates.filter((time) => time > 0)),
    retry: () => {
      failed.forEach((query) => void query.refetch());
      if (servicesError) void services.refetch();
    },
  };
}
