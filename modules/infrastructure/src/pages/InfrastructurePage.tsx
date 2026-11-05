import { clustersQuery, useHostLinks, useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Button,
  PageHeader,
  SectionCard,
  Skeleton,
  StatCard,
  StatGroup,
  QueryErrorAlert,
  formatBytes,
} from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import {
  CpuIcon,
  ExternalLinkIcon,
  GpuIcon,
  MemoryStickIcon,
  NetworkIcon,
  ServerIcon,
} from 'lucide-react';

import { ClusterMap } from '../components/ClusterMap';
import { ClustersEmptyState } from '../components/ClustersEmptyState';
import { ClusterTable } from '../components/ClusterTable';
import { clusterTotals } from '../lib';

export function InfrastructurePage() {
  const api = useOakestraApi();
  const { grafanaUrl } = useHostLinks();
  const clusters = useQuery(clustersQuery(api));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Infrastructure"
        actions={
          grafanaUrl ? (
            <Button variant="outline" asChild>
              <a href={grafanaUrl} target="_blank" rel="noreferrer">
                Open Grafana
                <ExternalLinkIcon />
              </a>
            </Button>
          ) : null
        }
      />

      {clusters.isPending ? (
        <div className="space-y-4" data-testid="infrastructure-loading">
          <StatGroup>
            {['Clusters', 'Nodes', 'CPU cores', 'Memory'].map((label) => (
              <StatCard key={label} label={label} value="" hint="active" loading />
            ))}
          </StatGroup>
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : clusters.isError ? (
        <QueryErrorAlert
          title="Could not load clusters"
          error={clusters.error}
          onRetry={() => void clusters.refetch()}
        />
      ) : clusters.data.length === 0 ? (
        <ClustersEmptyState />
      ) : (
        <Loaded clusters={clusters.data} />
      )}
    </div>
  );
}

function Loaded({ clusters }: { clusters: Parameters<typeof clusterTotals>[0] }) {
  const totals = clusterTotals(clusters);
  const showGpu = totals.gpuCores > 0;
  return (
    <>
      <div className="space-y-1.5">
        <StatGroup data-testid="summary">
          <StatCard
            label="Clusters"
            value={`${totals.activeClusters}/${totals.clusters}`}
            hint="active"
            icon={<ServerIcon />}
          />
          <StatCard label="Nodes" value={totals.activeNodes} hint="active" icon={<NetworkIcon />} />
          <StatCard label="CPU cores" value={totals.cpuCores} icon={<CpuIcon />} />
          <StatCard
            label="Memory"
            value={formatBytes(totals.memoryBytes)}
            icon={<MemoryStickIcon />}
          />
          {showGpu ? (
            <StatCard label="GPU cores" value={totals.gpuCores} icon={<GpuIcon />} />
          ) : null}
        </StatGroup>
        <p className="text-muted-foreground text-xs">Capacity counts active clusters only.</p>
      </div>
      <ClusterTable clusters={clusters} />
      <SectionCard
        title="Locations"
        description="Where the clusters sit. Circles show their radius."
        flush
      >
        <ClusterMap clusters={clusters} className="h-64 w-full sm:h-80" linkToDetail />
      </SectionCard>
    </>
  );
}
