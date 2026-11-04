import { useOakestraApi, type AddonCrumbProps } from '@oakestra/dashboard-sdk';
import { useQuery } from '@tanstack/react-query';

import { clusterQuery } from '../queries';

/** Same query options as the page, so the crumb and the page share one cache entry. */
export function ClusterCrumb({ params }: AddonCrumbProps) {
  const cluster = useQuery(clusterQuery(useOakestraApi(), params.clusterId ?? ''));
  return cluster.data?.cluster_name ?? 'Cluster';
}
