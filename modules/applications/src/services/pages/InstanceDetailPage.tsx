import { LocationMap, toMapLocation } from '@oakestra/ui/location-map';
import { TimeSeriesChart } from '@oakestra/ui/chart';
import { parseClusterLocation } from '@oakestra/api';
import {
  clustersQuery,
  useAddonPath,
  useFeatureEnabled,
  useOakestraApi,
  usePermissions,
} from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  SectionCard,
  Skeleton,
  StatCard,
  StatGroup,
  CopyButton,
  QueryErrorAlert,
  formatBytes,
  formatPercent,
  formatRelativeTime,
} from '@oakestra/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

import { isNotFound, NotFound } from '../../components/NotFound';
import { seededServiceQuery } from '../../queries';
import { useUndeployInstance } from '../mutations';
import { DefinitionList } from '../components/DefinitionList';
import { LogsCard } from '../components/LogsCard';
import { INFRASTRUCTURE_ROLES } from '../infrastructure-roles';
import { StatusBadge } from '../components/StatusBadge';
import {
  describeStatus,
  hasMetrics,
  instanceHost,
  instanceProblem,
  usePollWhileTransitional,
} from '../status';

// Metrics and logs change constantly, so the page refreshes on its own; faster while the
// scheduler is still placing the instance.
const REFRESH_MS = 15_000;

export function InstanceDetailPage() {
  const { appId = '', serviceId = '', instanceNumber = '' } = useParams();
  const api = useOakestraApi();
  const permissions = usePermissions();
  const infrastructureEnabled = useFeatureEnabled('infrastructure');
  const addonPath = useAddonPath();
  const refetchInterval = usePollWhileTransitional(REFRESH_MS);
  const service = useQuery({
    ...seededServiceQuery(api, useQueryClient(), serviceId),
    refetchInterval,
  });
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

  const back = addonPath(appId, 'services', serviceId);

  if (service.isPending) {
    return (
      <div className="space-y-4" data-testid="instance-loading">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isNotFound(service.error)) {
    return (
      <NotFound
        title="Service not found"
        description="It may have been deleted."
        back={addonPath(appId)}
        backLabel="Back to the application"
      />
    );
  }
  if (service.isError) {
    return (
      <QueryErrorAlert
        title="Could not load the instance"
        error={service.error}
        onRetry={() => void service.refetch()}
      />
    );
  }
  if (!instance) {
    return (
      <NotFound
        title="Instance not found"
        description="It may have been undeployed."
        back={back}
        backLabel="Back to the service"
      />
    );
  }

  const host = instanceHost(instance);
  const mono = (value: string | undefined) =>
    value ? (
      <span className="inline-flex items-center gap-1">
        <span className="font-mono text-xs">{value}</span>
        <CopyButton value={value} label={`Copy ${value}`} size="icon-xs" />
      </span>
    ) : undefined;
  const { tone: statusTone } = describeStatus(instance.status);
  const problem = instanceProblem(instance);
  const measured = hasMetrics(instance);
  const canOpenCluster = infrastructureEnabled && permissions.hasAnyRole(INFRASTRUCTURE_ROLES);
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
    <div className="space-y-5">
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

      <StatGroup>
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
      </StatGroup>

      <SectionCard title="Placement" contentClassName="grid gap-x-8 gap-y-4 lg:grid-cols-2">
        <DefinitionList
          items={[
            { label: 'Cluster', value: clusterValue },
            { label: 'Worker node', value: mono(instance.worker_id) },
            { label: 'Host address', value: mono(host) },
            { label: 'Public IP', value: mono(instance.publicip) },
          ]}
          empty="Not placed on a node yet."
        />
        {locations.length > 0 ? (
          <LocationMap locations={locations} ariaLabel="Cluster location" className="h-44 w-full" />
        ) : (
          <EmptyState icon={<MapPinOffIcon />} title="No location reported yet" className="py-4" />
        )}
      </SectionCard>

      <SectionCard
        title="Usage"
        description="Recent samples, refreshed every 15 s"
        contentClassName="grid gap-x-8 gap-y-4 lg:grid-cols-2"
      >
        <div>
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <h3 className="font-semibold">CPU</h3>
            <span className="tabular-nums">
              {measured ? formatPercent(instance.cpu_percent) : '-'}
            </span>
          </div>
          <TimeSeriesChart title="CPU usage" unit="percent" data={instance.cpu_history} />
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <h3 className="font-semibold">Memory</h3>
            <span className="tabular-nums">
              {measured ? formatBytes(instance.memory_percent) : '-'}
            </span>
          </div>
          <TimeSeriesChart
            title="Memory usage"
            color="var(--chart-2)"
            unit="bytes"
            data={instance.memory_history}
          />
        </div>
      </SectionCard>

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
