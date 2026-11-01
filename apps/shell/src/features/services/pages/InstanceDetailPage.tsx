import { parseClusterLocation } from '@oakestra/api';
import { useOakestraApi, usePermissions } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
} from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import {
  ClockIcon,
  CpuIcon,
  HardDriveIcon,
  MapPinOffIcon,
  MemoryStickIcon,
  SquareIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { CopyButton } from '../../../components/CopyButton';
import { LocationMap, toMapLocation } from '../../../components/LocationMap';
import { TimeSeriesChart } from '../../../components/TimeSeriesChart';
import { describeError } from '../../../core/api/errors';
import { formatBytes, formatPercent, formatRelativeTime } from '../../../lib/format';
import { clustersQuery } from '../../infrastructure';
import { useUndeployInstance } from '../api/mutations';
import { serviceQuery } from '../api/queries';
import { DefinitionList } from '../components/DefinitionList';
import { LogsCard } from '../components/LogsCard';
import { hasMetrics } from '../components/ServiceOverview';
import { StatusBadge } from '../components/StatusBadge';
import { describeStatus, usePollWhileTransitional } from '../status';

// Metrics and logs change constantly, so the page refreshes on its own; faster while the
// scheduler is still placing the instance.
const REFRESH_MS = 15_000;

export function InstanceDetailPage() {
  const { appId = '', serviceId = '', instanceNumber = '' } = useParams();
  const api = useOakestraApi();
  const permissions = usePermissions();
  const refetchInterval = usePollWhileTransitional(REFRESH_MS);
  const service = useQuery({ ...serviceQuery(api, serviceId), refetchInterval });
  const clusters = useQuery(clustersQuery(api));
  const navigate = useNavigate();
  const undeploy = useUndeployInstance();
  const [confirming, setConfirming] = useState(false);

  const instance = service.data?.instance_list.find(
    (candidate) => String(candidate.instance_number) === instanceNumber,
  );
  const cluster = clusters.data?.find((candidate) => candidate._id === instance?.cluster_id);
  const clusterName = cluster?.cluster_name ?? instance?.cluster_id;

  const locations = useMemo(() => {
    const location = toMapLocation(
      clusterName ?? 'Cluster',
      parseClusterLocation(instance?.cluster_location),
    );
    return location ? [location] : [];
  }, [clusterName, instance?.cluster_location]);

  const back = `/applications/${appId}/services/${serviceId}`;

  if (service.isPending) {
    return (
      <div className="space-y-4" data-testid="instance-loading">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (service.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load the instance</AlertTitle>
        <AlertDescription>
          <p>{describeError(service.error)}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => void service.refetch()}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!instance) {
    return (
      <EmptyState
        title="Instance not found"
        description="It may have been undeployed."
        action={
          <Button asChild variant="outline">
            <Link to={back}>Back to the service</Link>
          </Button>
        }
      />
    );
  }

  const host = instance.host_ip
    ? instance.host_port
      ? `${instance.host_ip}:${instance.host_port}`
      : instance.host_ip
    : undefined;
  const mono = (value: string | undefined) =>
    value ? (
      <span className="inline-flex items-center gap-1">
        <span className="font-mono text-xs">{value}</span>
        <CopyButton value={value} label={`Copy ${value}`} size="icon-xs" />
      </span>
    ) : undefined;
  const { tone: statusTone } = describeStatus(instance.status);
  // A running instance keeps its last scheduler message; shown next to the badge it contradicts it.
  const problem =
    instance.status_detail && statusTone !== 'success' ? instance.status_detail : undefined;
  const measured = hasMetrics(instance);
  const canOpenCluster = permissions.hasAnyRole(['Admin', 'Infrastructure_Provider']);
  const clusterValue =
    clusterName && instance.cluster_id ? (
      canOpenCluster ? (
        <Link
          to={`/infrastructure/clusters/${instance.cluster_id}`}
          className="font-medium text-primary hover:underline"
        >
          {clusterName}
        </Link>
      ) : (
        clusterName
      )
    ) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {service.data.microservice_name} #{instance.instance_number}
            <StatusBadge status={instance.status} detail={problem} />
          </span>
        }
        actions={
          <Button variant="outline" onClick={() => setConfirming(true)}>
            <SquareIcon aria-hidden /> Undeploy
          </Button>
        }
      />

      {problem ? (
        <Alert
          variant={
            statusTone === 'destructive' || statusTone === 'warning' ? statusTone : 'default'
          }
        >
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="CPU"
          value={measured ? formatPercent(instance.cpu_percent) : '-'}
          icon={<CpuIcon />}
        />
        <StatCard
          label="Memory"
          value={measured ? formatBytes(instance.memory_percent) : '-'}
          icon={<MemoryStickIcon />}
        />
        <StatCard
          label="Disk"
          value={instance.disk === undefined ? '-' : formatBytes(instance.disk)}
          icon={<HardDriveIcon />}
        />
        <StatCard
          label="Last update"
          value={
            instance.last_modified_timestamp
              ? formatRelativeTime(instance.last_modified_timestamp)
              : '-'
          }
          icon={<ClockIcon />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Placement</CardTitle>
          </CardHeader>
          <CardContent>
            <DefinitionList
              items={[
                { label: 'Cluster', value: clusterValue },
                { label: 'Worker node', value: mono(instance.worker_id) },
                { label: 'Host address', value: mono(host) },
                { label: 'Public IP', value: mono(instance.publicip) },
              ]}
              empty="Not placed on a node yet."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent>
            {locations.length > 0 ? (
              <LocationMap
                locations={locations}
                ariaLabel="Cluster location"
                className="h-56 w-full"
              />
            ) : (
              <EmptyState
                icon={<MapPinOffIcon />}
                title="No location reported yet"
                className="py-8"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CPU</CardTitle>
            <CardDescription>Recent samples, refreshed every 15 s</CardDescription>
            <CardAction className="text-lg font-semibold tabular-nums">
              {measured ? formatPercent(instance.cpu_percent) : '-'}
            </CardAction>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart title="CPU usage" unit="percent" data={instance.cpu_history} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Memory</CardTitle>
            <CardDescription>Recent samples, refreshed every 15 s</CardDescription>
            <CardAction className="text-lg font-semibold tabular-nums">
              {measured ? formatBytes(instance.memory_percent) : '-'}
            </CardAction>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart title="Memory usage" unit="bytes" data={instance.memory_history} />
          </CardContent>
        </Card>
      </div>

      <LogsCard
        logs={instance.logs}
        filename={`${service.data.microservice_name}-${instance.instance_number}.log`}
        updatedAt={service.dataUpdatedAt}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Undeploy instance ${instance.instance_number}?`}
        description="The instance is stopped and removed. The service stays."
        confirmLabel="Undeploy"
        destructive
        pending={undeploy.isPending}
        onConfirm={() =>
          undeploy.mutate(
            { serviceId, instanceNumber: instance.instance_number },
            {
              onSuccess: () => void navigate(back, { replace: true }),
              onSettled: () => setConfirming(false),
            },
          )
        }
      />
    </div>
  );
}
