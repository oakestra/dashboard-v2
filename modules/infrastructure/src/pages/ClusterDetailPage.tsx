import { TimeSeriesChart } from '@oakestra/ui/chart';
import { parseClusterLocation, type Cluster } from '@oakestra/api';
import { Slot, useAddonPath, useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  SectionCard,
  Skeleton,
  SourceTag,
  StatCard,
  StatGroup,
  CopyButton,
  QueryErrorAlert,
  formatBytes,
  formatMegabytes,
  formatPercent,
  formatRelativeTime,
} from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import {
  ChartNoAxesColumnIcon,
  CpuIcon,
  MemoryStickIcon,
  NetworkIcon,
  SearchXIcon,
  ThermometerIcon,
  TriangleAlertIcon,
  ZapIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';

import { clusterQuery } from '../queries';
import { ClusterMap } from '../components/ClusterMap';
import { ClusterStatusBadge } from '../components/ClusterStatusBadge';
import { clusterPresentation, clusterUsage } from '../lib';

export function ClusterDetailPage() {
  const { clusterId = '' } = useParams();
  const api = useOakestraApi();
  const cluster = useQuery(clusterQuery(api, clusterId));

  const addonPath = useAddonPath();

  if (cluster.isPending) {
    return (
      <div className="space-y-4" data-testid="cluster-loading">
        <Skeleton className="h-10 w-64" />
        <StatGroup>
          {['CPU usage', 'Memory usage', 'Active nodes'].map((label) => (
            <StatCard key={label} label={label} value="" hint="of 0" loading />
          ))}
        </StatGroup>
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
        <QueryErrorAlert
          title="Could not load the cluster"
          error={cluster.error}
          onRetry={() => void cluster.refetch()}
        />
      </div>
    );
  }
  if (!cluster.data) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={<SearchXIcon />}
          title="Cluster not found"
          description="This cluster does not exist or is no longer registered."
          action={
            <Button variant="outline" asChild>
              <Link to={addonPath()}>All clusters</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ClusterDetail cluster={cluster.data} />
    </div>
  );
}

function ClusterDetail({ cluster }: { cluster: Cluster }) {
  const location = parseClusterLocation(cluster.cluster_location);
  const { gpu_temp: gpuTemp, vram_percent: vramPercent, vcpus } = cluster;
  const hasGpu = (cluster.total_gpu_cores ?? 0) > 0;
  const { state } = clusterPresentation(cluster);
  const usage = clusterUsage(cluster);
  const reporting = state === 'reporting';
  const widgetContext = useMemo(() => ({ clusterId: cluster._id }), [cluster._id]);
  // A silent cluster keeps its last report, which would otherwise read as an idle cluster, so its
  // tiles carry "last known" and zeros are left out.
  const suffix = usage.lastKnown ? ', last known' : '';
  const hasUsage =
    usage.cpuPercent !== undefined ||
    usage.memoryPercent !== undefined ||
    usage.memoryAvailableBytes !== undefined ||
    usage.activeNodes !== undefined;
  const lastReport = formatRelativeTime(cluster.last_modified_timestamp);

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
    { title: 'Supported addons', items: cluster.supported_addons },
    { title: 'CSI drivers', items: cluster.csi_drivers },
    { title: 'GPU drivers', items: cluster.gpu_drivers },
  ];
  const reported = capabilities.filter((group) => group.items.length > 0);
  const showCharts = reporting && (cpuHistory.length > 0 || memoryHistory.length > 0);

  return (
    <>
      <PageHeader
        title={cluster.cluster_name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ClusterStatusBadge cluster={cluster} />
            <span className={reporting ? undefined : 'text-muted-foreground'}>
              {state === 'never-reported' ? 'Never reported' : `Last seen ${lastReport}`}
            </span>
          </span>
        }
      />

      {reporting ? null : (
        <Alert variant="warning" data-testid="cluster-notice">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>
            {state === 'never-reported'
              ? 'This cluster has not reported yet. There are no values to show.'
              : hasUsage
                ? `This cluster is not reporting. Last report ${lastReport}; the figures below are last known, not current.`
                : `This cluster is not reporting. Last report ${lastReport}.`}
          </AlertTitle>
        </Alert>
      )}

      {hasUsage ? (
        <StatGroup data-testid="cluster-stats">
          {usage.cpuPercent === undefined ? null : (
            <StatCard
              label={`CPU usage${suffix}`}
              icon={<CpuIcon />}
              value={formatPercent(usage.cpuPercent)}
              hint={cpuHint}
            />
          )}
          {usage.memoryPercent === undefined ? null : (
            <StatCard
              label={`Memory usage${suffix}`}
              icon={<MemoryStickIcon />}
              value={formatPercent(usage.memoryPercent)}
              hint={
                usage.memoryAvailableBytes
                  ? `${formatBytes(usage.memoryAvailableBytes)} available`
                  : undefined
              }
            />
          )}
          {usage.activeNodes === undefined ? null : (
            <StatCard
              label={`Active nodes${suffix}`}
              icon={<NetworkIcon />}
              value={String(usage.activeNodes)}
            />
          )}
          {reporting && hasGpu ? (
            <>
              <StatCard
                label="GPU usage"
                icon={<ZapIcon />}
                value={formatPercent(cluster.gpu_percent)}
              />
              {gpuTemp !== undefined ? (
                <StatCard
                  label="GPU temperature"
                  icon={<ThermometerIcon />}
                  value={`${gpuTemp} °C`}
                />
              ) : null}
              {cluster.vram ? (
                <StatCard
                  label="VRAM"
                  icon={<MemoryStickIcon />}
                  value={formatMegabytes(cluster.vram)}
                  hint={
                    vramPercent === undefined ? undefined : `${formatPercent(vramPercent)} used`
                  }
                />
              ) : null}
            </>
          ) : null}
        </StatGroup>
      ) : null}

      {showCharts ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <HistoryCard title="CPU usage" data={cpuHistory} />
          <HistoryCard title="Memory usage" data={memoryHistory} color="var(--chart-2)" />
        </div>
      ) : null}

      <SectionCard title="Capabilities">
        {reported.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No virtualization, addons, CSI or GPU drivers reported.
          </p>
        ) : (
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
            {reported.map((group) => (
              <div key={group.title} className="contents">
                <dt
                  className="text-muted-foreground text-sm"
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
          flush
        >
          <ClusterMap clusters={[cluster]} className="h-56 w-full" ariaLabel="Cluster location" />
        </SectionCard>
      ) : null}

      <Slot
        point="cluster.widgets"
        context={widgetContext}
        render={(item, content, source) => (
          <Card>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              {source.remote ? (
                <CardAction>
                  <SourceTag name={source.displayName ?? source.id} version={source.version} />
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>{content}</CardContent>
          </Card>
        )}
      />
    </>
  );
}

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
