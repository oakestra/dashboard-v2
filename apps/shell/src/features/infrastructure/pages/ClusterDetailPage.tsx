import { parseClusterLocation, type Cluster } from '@oakestra/api';
import { useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, SearchXIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { TimeSeriesChart } from '../../../components/TimeSeriesChart';
import { describeError } from '../../../core/api/errors';
import { Slot } from '../../../core/extensions/Slot';
import { formatBytes, formatPercent, formatRelativeTime } from '../../../lib/format';
import { clusterQuery } from '../api/queries';
import { ClusterMap } from '../components/ClusterMap';
import { ClusterStatusBadge } from '../components/ClusterStatusBadge';
import { StatCard } from '../components/StatCard';
import { extraNumber, itemLabels, totalMemoryBytes } from '../lib';

export function ClusterDetailPage() {
  const { clusterId = '' } = useParams();
  const api = useOakestraApi();
  const cluster = useQuery(clusterQuery(api, clusterId));

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link to="/infrastructure">
        <ArrowLeftIcon />
        All clusters
      </Link>
    </Button>
  );

  if (cluster.isPending) {
    return (
      <div className="space-y-4" data-testid="cluster-loading">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (cluster.isError) {
    return (
      <div className="space-y-4">
        {back}
        <Alert variant="destructive">
          <AlertTitle>Could not load the cluster</AlertTitle>
          <AlertDescription>
            <p>{describeError(cluster.error)}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void cluster.refetch()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!cluster.data) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          icon={<SearchXIcon />}
          title="Cluster not found"
          description="This cluster does not exist or is no longer registered."
        />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {back}
      <ClusterDetail cluster={cluster.data} />
    </div>
  );
}

function ClusterDetail({ cluster }: { cluster: Cluster }) {
  const location = parseClusterLocation(cluster.cluster_location);
  const gpuPercent = extraNumber(cluster, 'gpu_percent') ?? cluster.gpu_percent;
  const gpuTemp = extraNumber(cluster, 'gpu_temp');
  const vramPercent = extraNumber(cluster, 'vram_percent');
  const vcpus = extraNumber(cluster, 'vcpus');
  const hasGpu = (cluster.total_gpu_cores ?? 0) > 0;
  const memoryTotal = totalMemoryBytes(cluster);

  const cpuHistory = cluster.cpu_history.map(({ timestamp, value }) => ({ timestamp, value }));
  const memoryHistory = cluster.memory_history.map(({ timestamp, value }) => ({
    timestamp,
    value,
  }));

  return (
    <>
      <PageHeader
        title={cluster.cluster_name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ClusterStatusBadge active={cluster.active} />
            <span>
              {location
                ? `${location.latitude}, ${location.longitude}${location.radius ? ` (radius ${location.radius} km)` : ''}`
                : 'No location'}
            </span>
            <span>Last seen {formatRelativeTime(cluster.last_modified_timestamp)}</span>
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="cluster-stats">
        <StatCard
          label="CPU usage"
          value={formatPercent(cluster.cpu_percent ?? cluster.aggregated_cpu_percent)}
          hint={
            cluster.total_cpu_cores === undefined ? undefined : `${cluster.total_cpu_cores} cores`
          }
        />
        <StatCard
          label="Memory usage"
          value={formatPercent(cluster.memory_percent)}
          hint={memoryTotal === undefined ? undefined : `of ${formatBytes(memoryTotal)}`}
        />
        <StatCard label="Active nodes" value={cluster.active_nodes ?? 0} />
        {vcpus !== undefined ? <StatCard label="vCPUs" value={vcpus} /> : null}
        {hasGpu ? (
          <>
            <StatCard label="GPU usage" value={formatPercent(gpuPercent)} />
            {gpuTemp !== undefined ? (
              <StatCard label="GPU temperature" value={`${gpuTemp} °C`} />
            ) : null}
            {cluster.vram ? (
              <StatCard
                label="VRAM"
                value={formatBytes(cluster.vram * 1024 * 1024)}
                hint={vramPercent === undefined ? undefined : `${formatPercent(vramPercent)} used`}
              />
            ) : null}
          </>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="CPU usage" empty={cpuHistory.length === 0}>
          <TimeSeriesChart title="CPU usage" unit="percent" data={cpuHistory} />
        </ChartCard>
        <ChartCard title="Memory usage" empty={memoryHistory.length === 0}>
          <TimeSeriesChart
            title="Memory usage"
            unit="percent"
            data={memoryHistory}
            color="var(--chart-2)"
          />
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Capabilities</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <BadgeGroup title="Virtualization" items={cluster.virtualization} />
          <BadgeGroup title="Supported addons" items={itemLabels(cluster.supported_addons)} />
          <BadgeGroup title="CSI drivers" items={itemLabels(cluster.csi_drivers)} />
          <BadgeGroup title="GPU drivers" items={itemLabels(cluster.gpu_drivers)} />
        </CardContent>
      </Card>

      {location ? (
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent>
            <ClusterMap clusters={[cluster]} className="h-56 w-full" ariaLabel="Cluster location" />
          </CardContent>
        </Card>
      ) : null}

      <Slot
        point="cluster.widgets"
        context={{ clusterId: cluster._id }}
        render={(item, content) => (
          <Card>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent>{content}</CardContent>
          </Card>
        )}
      />
    </>
  );
}

function ChartCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-muted-foreground text-sm">No history reported yet.</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function BadgeGroup({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">None</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <Badge key={item} variant="secondary">
              {item}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
