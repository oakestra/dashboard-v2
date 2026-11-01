import { useOakestraApi } from '@oakestra/dashboard-sdk';
import { Alert, AlertDescription, AlertTitle, Button, PageHeader, Skeleton } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { ExternalLinkIcon } from 'lucide-react';

import { describeError } from '../../../core/api/errors';
import { useAppConfig } from '../../../core/config/config-context';
import { formatBytes } from '../../../lib/format';
import { clustersQuery } from '../api/queries';
import { ClusterMap } from '../components/ClusterMap';
import { ClustersEmptyState } from '../components/ClustersEmptyState';
import { ClusterTable } from '../components/ClusterTable';
import { StatCard } from '../components/StatCard';
import { summarize } from '../lib';

export function InfrastructurePage() {
  const api = useOakestraApi();
  const { grafanaUrl } = useAppConfig();
  const clusters = useQuery(clustersQuery(api));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Infrastructure"
        description="Clusters registered with this Oakestra deployment."
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
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : clusters.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load clusters</AlertTitle>
          <AlertDescription>
            <p>{describeError(clusters.error)}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void clusters.refetch()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : clusters.data.length === 0 ? (
        <ClustersEmptyState />
      ) : (
        <Loaded clusters={clusters.data} />
      )}
    </div>
  );
}

function Loaded({ clusters }: { clusters: Parameters<typeof summarize>[0] }) {
  const totals = summarize(clusters);
  return (
    <>
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        data-testid="summary"
      >
        <StatCard label="Clusters" value={totals.clusters} />
        <StatCard label="Active clusters" value={totals.activeClusters} />
        <StatCard label="Active nodes" value={totals.activeNodes} />
        <StatCard label="CPU cores" value={totals.cpuCores} hint="Active only" />
        <StatCard label="Memory" value={formatBytes(totals.memoryBytes)} hint="Active only" />
        <StatCard label="GPU cores" value={totals.gpuCores} hint="Active only" />
      </div>
      <ClusterMap clusters={clusters} className="h-80 w-full" />
      <ClusterTable clusters={clusters} />
    </>
  );
}
