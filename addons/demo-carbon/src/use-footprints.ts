import { clustersQuery, useOakestraApi } from '@oakestra/dashboard-sdk';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { footprintOf, type ClusterFootprint } from './estimate';

/** Footprints of all clusters, from the cache entry the shell and other addons share. */
export function useFootprints() {
  const api = useOakestraApi();
  const query = useQuery(clustersQuery(api));
  const data = query.data;
  // The hour is the finest grain of the estimate, so re-deriving per data change is enough.
  const footprints = useMemo<ClusterFootprint[] | undefined>(() => {
    const now = new Date();
    return data?.map((cluster) => footprintOf(cluster, now));
  }, [data]);
  return { query, footprints };
}
