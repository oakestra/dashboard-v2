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
  cn,
  EmptyState,
  PageHeader,
  SectionCard,
  Skeleton,
  StatCard,
} from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  ChartNoAxesColumnIcon,
  CpuIcon,
  MemoryStickIcon,
  NetworkIcon,
  SearchXIcon,
  ThermometerIcon,
  TriangleAlertIcon,
  ZapIcon,
} from 'lucide-react';
import { Link, useParams } from 'react-router';

import { CopyButton } from '../../../components/CopyButton';
import { TimeSeriesChart } from '../../../components/TimeSeriesChart';
import { describeError } from '../../../core/api/errors';
import { Slot } from '../../../core/extensions/Slot';
import { formatBytes, formatPercent, formatRelativeTime } from '../../../lib/format';
import { clusterQuery } from '../api/queries';
import { ClusterMap } from '../components/ClusterMap';
import { ClusterStatusBadge } from '../components/ClusterStatusBadge';
import { extraNumber, itemLabels, totalMemoryBytes } from '../lib';

export function ClusterDetailPage() {
  const { clusterId = '' } = useParams();
  const api = useOakestraApi();
  const cluster = useQuery(clusterQuery(api, clusterId));

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 md:hidden">
      <Link to="/infrastructure">
        <ArrowLeftIcon />
        All clusters
      </Link>
    </Button>
  );

  if (cluster.isPending) {
    return (
      <div className="space-y-6" data-testid="cluster-loading">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {['CPU usage', 'Memory usage', 'Active nodes'].map((label) => (
            <StatCard key={label} label={label} value="" hint="of 0" loading />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
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
  const { active } = cluster;
  // An inactive cluster keeps its last report, which would otherwise read as an idle cluster.
  const live = (value: string) => (active ? value : '-');
  const noData = active ? undefined : 'No current data';

  const cpuHistory = cluster.cpu_history.map(({ timestamp, value }) => ({ timestamp, value }));
  const memoryHistory = cluster.memory_history.map(({ timestamp, value }) => ({
    timestamp,
    value,
  }));
  const cores = cluster.total_cpu_cores;
  const cpuHint =
    cores === undefined
      ? undefined
      : vcpus !== undefined && vcpus !== cores
        ? `${cores} cores, ${vcpus} vCPUs`
        : `${cores} cores`;
  const coordinates = location ? `${location.latitude}, ${location.longitude}` : null;
  const capabilities = [
    { title: 'Virtualization', items: cluster.virtualization },
    { title: 'Supported addons', items: itemLabels(cluster.supported_addons) },
    { title: 'CSI drivers', items: itemLabels(cluster.csi_drivers) },
    { title: 'GPU drivers', items: itemLabels(cluster.gpu_drivers) },
  ];
  const reported = capabilities.filter((group) => group.items.length > 0);
  const statCount = 3 + (hasGpu ? 1 + (gpuTemp === undefined ? 0 : 1) + (cluster.vram ? 1 : 0) : 0);

  return (
    <>
      <PageHeader
        title={cluster.cluster_name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ClusterStatusBadge active={active} />
            <span className={active ? undefined : 'text-warning'}>
              Last seen {formatRelativeTime(cluster.last_modified_timestamp)}
            </span>
          </span>
        }
      />

      {active ? null : (
        <Alert variant="warning">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>This cluster is not reporting</AlertTitle>
          <AlertDescription>
            Last report {formatRelativeTime(cluster.last_modified_timestamp)}. Its nodes may be
            offline or unable to reach the root orchestrator.
          </AlertDescription>
        </Alert>
      )}

      <div
        className={cn('grid grid-cols-2 gap-4', statColumns[statCount] ?? 'lg:grid-cols-4')}
        data-testid="cluster-stats"
      >
        <StatCard
          label="CPU usage"
          icon={<CpuIcon />}
          value={live(formatPercent(cluster.cpu_percent ?? cluster.aggregated_cpu_percent))}
          hint={noData ?? cpuHint}
        />
        <StatCard
          label="Memory usage"
          icon={<MemoryStickIcon />}
          value={live(formatPercent(cluster.memory_percent))}
          hint={noData ?? (memoryTotal ? `of ${formatBytes(memoryTotal)}` : undefined)}
        />
        <StatCard
          label="Active nodes"
          icon={<NetworkIcon />}
          value={live(String(cluster.active_nodes ?? 0))}
          hint={noData}
        />
        {hasGpu ? (
          <>
            <StatCard
              label="GPU usage"
              icon={<ZapIcon />}
              value={live(formatPercent(gpuPercent))}
              hint={noData}
            />
            {gpuTemp !== undefined ? (
              <StatCard
                label="GPU temperature"
                icon={<ThermometerIcon />}
                value={live(`${gpuTemp} °C`)}
                hint={noData}
              />
            ) : null}
            {cluster.vram ? (
              <StatCard
                label="VRAM"
                icon={<MemoryStickIcon />}
                value={formatBytes(cluster.vram * 1024 * 1024)}
                hint={
                  noData ??
                  (vramPercent === undefined ? undefined : `${formatPercent(vramPercent)} used`)
                }
              />
            ) : null}
          </>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <HistoryCard title="CPU usage" data={cpuHistory} />
        <HistoryCard title="Memory usage" data={memoryHistory} color="var(--chart-2)" />
      </div>

      {/* items-start: a short capabilities list should not stretch to the map's height. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <SectionCard
          title="Capabilities"
          description={reported.length === 0 ? undefined : 'What this cluster reports it supports.'}
        >
          {reported.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No virtualization, addons, CSI or GPU drivers reported.
            </p>
          ) : (
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-[max-content_1fr]">
              {reported.map((group) => (
                <div key={group.title} className="contents">
                  <dt
                    className="text-sm font-medium"
                    id={`cap-${group.title.replaceAll(' ', '-')}`}
                  >
                    {group.title}
                  </dt>
                  <dd className="flex flex-wrap gap-1">
                    {group.items.map((item) => (
                      <Badge key={item} variant="secondary">
                        {item}
                      </Badge>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </SectionCard>

        {location ? (
          <SectionCard
            title="Location"
            description={
              <span className="inline-flex items-center gap-1">
                <span>
                  <span className="font-mono">{coordinates}</span>
                  {location.radius ? `, radius ${location.radius} km` : null}
                </span>
                <CopyButton value={coordinates ?? ''} label="Copy coordinates" size="icon-xs" />
              </span>
            }
          >
            <ClusterMap clusters={[cluster]} className="h-64 w-full" ariaLabel="Cluster location" />
          </SectionCard>
        ) : null}
      </div>

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

// Full rows of tiles at lg: three or six tiles look unfinished in a four column grid.
const statColumns: Record<number, string> = {
  3: 'lg:grid-cols-3',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-3',
};

/** "Last 3 minutes" from the first to the last sample; the backend keeps a short rolling window. */
function describeWindow(data: readonly { timestamp: Date }[]): string | undefined {
  const first = data.at(0)?.timestamp.getTime();
  const last = data.at(-1)?.timestamp.getTime();
  if (first === undefined || last === undefined) return undefined;
  const minutes = Math.max(1, Math.round((last - first) / 60_000));
  if (minutes < 60) return `Last ${minutes === 1 ? 'minute' : `${minutes} minutes`}`;
  const hours = Math.round(minutes / 60);
  return `Last ${hours === 1 ? 'hour' : `${hours} hours`}`;
}

function HistoryCard({
  title,
  data,
  color,
}: {
  title: string;
  data: readonly { timestamp: Date; value: number }[];
  color?: string;
}) {
  const latest = data.at(-1);
  return (
    <SectionCard
      title={title}
      description={describeWindow(data)}
      action={
        latest ? (
          // The tile above shows the cluster's current figure, the chart its sampled history; the
          // latest sample here keeps the two from visibly disagreeing without explanation.
          <span className="text-sm tabular-nums">
            <span className="text-muted-foreground">Latest </span>
            <span className="font-medium">{formatPercent(latest.value)}</span>
          </span>
        ) : null
      }
    >
      {latest ? (
        <TimeSeriesChart title={title} unit="percent" data={data} color={color} />
      ) : (
        <EmptyState
          className="h-56 py-0"
          icon={<ChartNoAxesColumnIcon />}
          title="No history yet"
          description="The cluster has not reported metrics."
        />
      )}
    </SectionCard>
  );
}
