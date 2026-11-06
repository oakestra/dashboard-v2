import type { Cluster } from '@oakestra/api';
import { StatusBadge } from '@oakestra/ui';

import { clusterPresentation } from '../lib';

export function ClusterStatusBadge({ cluster }: { cluster: Cluster }) {
  const { state, label, tone, stale } = clusterPresentation(cluster);
  return (
    <StatusBadge tone={tone} stale={stale} data-status={state}>
      {label}
    </StatusBadge>
  );
}
