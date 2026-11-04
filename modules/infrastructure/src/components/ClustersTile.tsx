import {
  clustersQuery,
  useAddonPath,
  useOakestraApi,
  usePermissions,
} from '@oakestra/dashboard-sdk';
import { StatCard, plural } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { ServerIcon } from 'lucide-react';
import { Link } from 'react-router';

import { clusterTotals } from '../lib';
import { INFRASTRUCTURE_ROLES } from '../roles';

/**
 * Overview tile (`home.widgets`, size `stat`). Everyone sees it, because `/clusters/` needs no
 * role and whoever deploys cares whether the platform is up. Only those who may open the
 * infrastructure pages get a link.
 */
export function ClustersTile() {
  const api = useOakestraApi();
  const addonPath = useAddonPath();
  const canOpen = usePermissions().hasAnyRole(INFRASTRUCTURE_ROLES);
  const clusters = useQuery(clustersQuery(api));
  const totals = clusterTotals(clusters.data ?? []);

  return (
    <StatCard
      label="Clusters"
      value={clusters.isError ? '-' : `${totals.activeClusters}/${totals.clusters}`}
      icon={<ServerIcon />}
      tone={clusters.isSuccess && totals.activeClusters === 0 ? 'warning' : 'default'}
      hint={
        clusters.isError
          ? 'Could not load clusters'
          : `active, ${plural(totals.activeNodes, 'node')}`
      }
      loading={clusters.isPending}
      asChild={canOpen}
    >
      {canOpen ? <Link to={addonPath()} /> : undefined}
    </StatCard>
  );
}
