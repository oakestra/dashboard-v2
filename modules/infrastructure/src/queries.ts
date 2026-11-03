import type { Cluster } from '@oakestra/api';
import { clustersQuery, type OakestraApi } from '@oakestra/dashboard-sdk';
import { queryOptions } from '@tanstack/react-query';

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
