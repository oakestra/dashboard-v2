import type { Cluster } from '@oakestra/api';
import type { OakestraApi } from '@oakestra/dashboard-sdk';
import { queryOptions } from '@tanstack/react-query';

import { clusterKeys } from '../keys';

export { clusterKeys };

/** Clusters report every few seconds; polling slower than that keeps the page fresh enough. */
export const CLUSTER_REFETCH_MS = 30_000;

export function clustersQuery(api: OakestraApi) {
  return queryOptions({
    queryKey: clusterKeys.list(),
    queryFn: ({ signal }) => api.clusters.list({ signal }),
    refetchInterval: CLUSTER_REFETCH_MS,
  });
}

/**
 * There is no cluster detail endpoint, so the detail page shares the list query (one cache entry,
 * one poll) and selects its cluster. `null` means the id is not in the list.
 */
export function clusterQuery(api: OakestraApi, clusterId: string) {
  return queryOptions({
    ...clustersQuery(api),
    select: (clusters: Cluster[]) => clusters.find((cluster) => cluster._id === clusterId) ?? null,
  });
}
