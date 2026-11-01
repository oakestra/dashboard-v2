import { parseClusterLocation } from '@oakestra/api';
import { useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, SquareIcon } from 'lucide-react';
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
import { StatusBadge } from '../components/StatusBadge';
import { usePollWhileTransitional } from '../status';

// Metrics and logs change constantly, so the page refreshes on its own; faster while the
// scheduler is still placing the instance.
const REFRESH_MS = 15_000;

export function InstanceDetailPage() {
  const { appId = '', serviceId = '', instanceNumber = '' } = useParams();
  const api = useOakestraApi();
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
    value ? <span className="font-mono text-xs">{value}</span> : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {service.data.microservice_name} #{instance.instance_number}
            <StatusBadge status={instance.status} />
          </span>
        }
        description={instance.status_detail}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={back}>
                <ArrowLeftIcon aria-hidden /> Service
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setConfirming(true)}>
              <SquareIcon aria-hidden /> Undeploy
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Placement</CardTitle>
          </CardHeader>
          <CardContent>
            <DefinitionList
              items={[
                { label: 'Cluster', value: clusterName },
                { label: 'Worker node', value: mono(instance.worker_id) },
                { label: 'Host address', value: mono(host) },
                { label: 'Public IP', value: mono(instance.publicip) },
                { label: 'CPU', value: formatPercent(instance.cpu_percent) },
                { label: 'Memory', value: formatBytes(instance.memory_percent) },
                {
                  label: 'Disk',
                  value: instance.disk === undefined ? undefined : formatBytes(instance.disk),
                },
                {
                  label: 'Last update',
                  value: instance.last_modified_timestamp
                    ? formatRelativeTime(instance.last_modified_timestamp)
                    : undefined,
                },
              ]}
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
              <p className="text-sm text-muted-foreground">No location reported yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CPU</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart title="CPU usage" unit="percent" data={instance.cpu_history} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Memory</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart
              title="Memory usage"
              unit="bytes"
              variant="line"
              color="var(--chart-2)"
              data={instance.memory_history}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Logs</CardTitle>
          {instance.logs ? <CopyButton value={instance.logs} label="Copy logs" /> : null}
        </CardHeader>
        <CardContent>
          {instance.logs ? (
            <pre
              // Keyboard users need focus on a scrollable region to scroll it.
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              data-testid="instance-logs"
              className="max-h-96 overflow-auto rounded-md bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap"
            >
              {instance.logs}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">No logs yet.</p>
          )}
        </CardContent>
      </Card>
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
