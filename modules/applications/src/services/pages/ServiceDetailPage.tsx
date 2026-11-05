import type { Cluster, Instance } from '@oakestra/api';
import {
  clustersQuery,
  Slot,
  useAddonPath,
  useCurrentUser,
  useOakestraApi,
} from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  PageHeader,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  CopyButton,
  JsonViewer,
  QueryErrorAlert,
  downloadJson,
  formatBytes,
  formatMegabytes,
  formatPercent,
} from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CircleAlertIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlayIcon,
  SquareIcon,
  Trash2Icon,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { isNotFound, NotFound } from '../../components/NotFound';
import { seededServiceQuery } from '../../queries';
import { useDeleteService, useDeployInstance, useUndeployInstance } from '../mutations';
import { hasMetrics, ServiceOverview } from '../components/ServiceOverview';
import { StatusBadge } from '../components/StatusBadge';
import { redactEnvironment, redactSlaEnvironment, serviceToSla } from '../sla';
import {
  describeStatus,
  formatVirtualization,
  instanceHost,
  instanceProblem,
  isTransitionalStatus,
  usePollWhileTransitional,
} from '../status';

const column = createDataTableColumnHelper<Instance>();

const NO_CLUSTER_NAMES: Readonly<Record<string, string>> = {};

// The cluster list changes with every 30s poll (load figures), but the names rarely do. A plain
// record rather than a Map, because TanStack Query structurally shares `select` results: the names
// keep their identity, so the instance columns are not rebuilt, which would close an open row menu.
function selectClusterNames(clusters: readonly Cluster[]): Record<string, string> {
  return Object.fromEntries(clusters.map((cluster) => [cluster._id, cluster.cluster_name]));
}

export function ServiceDetailPage() {
  const { appId = '', serviceId = '' } = useParams();
  const api = useOakestraApi();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const addonPath = useAddonPath();
  const refetchInterval = usePollWhileTransitional();
  const service = useQuery({
    ...seededServiceQuery(api, useQueryClient(), serviceId),
    refetchInterval,
  });
  const clusters = useQuery({ ...clustersQuery(api), select: selectClusterNames });
  const deploy = useDeployInstance();
  const undeploy = useUndeployInstance();
  const remove = useDeleteService();
  const [deleting, setDeleting] = useState(false);
  const [undeploying, setUndeploying] = useState<Instance | null>(null);
  const [tab, setTab] = useState('overview');

  const clusterNames = clusters.data ?? NO_CLUSTER_NAMES;
  const instancePath = useCallback(
    (instanceNumber: number) =>
      addonPath(appId, 'services', serviceId, 'instances', instanceNumber),
    [addonPath, appId, serviceId],
  );
  const slotContext = useMemo(() => ({ applicationId: appId, serviceId }), [appId, serviceId]);

  // Computed once per service response: JsonViewer memoizes its serialized text on `data`.
  const organization = user?.organization ?? '';
  const sla = useMemo(
    () => (service.data ? serviceToSla(service.data, organization) : undefined),
    [service.data, organization],
  );
  const slaJson = useMemo(() => (sla ? redactSlaEnvironment(sla) : undefined), [sla]);
  const serviceJson = useMemo(
    () => (service.data ? redactEnvironment(service.data) : undefined),
    [service.data],
  );

  const instanceColumns = useMemo(
    () =>
      column.columns([
        column.accessor('instance_number', {
          header: '#',
          cell: ({ row }) => (
            <Link
              aria-label={`Open instance ${row.original.instance_number}`}
              className="font-medium tabular-nums hover:underline"
              to={instancePath(row.original.instance_number)}
            >
              {row.original.instance_number}
            </Link>
          ),
        }),
        column.accessor((row) => row.status ?? '', {
          id: 'status',
          header: 'Status',
          cell: ({ row }) => {
            const problem = instanceProblem(row.original);
            return (
              <div>
                <StatusBadge status={row.original.status} detail={problem} />
                {problem ? (
                  <div className="mt-1 max-w-48 truncate text-xs text-muted-foreground">
                    {problem}
                  </div>
                ) : null}
              </div>
            );
          },
        }),
        column.accessor(
          (row) => (row.cluster_id ? (clusterNames[row.cluster_id] ?? row.cluster_id) : ''),
          { id: 'cluster', header: 'Cluster', cell: (info) => info.getValue() || '-' },
        ),
        column.accessor((row) => row.host_ip ?? '', {
          id: 'host',
          header: 'Host',
          cell: ({ row }) => (
            <span className="font-mono text-xs">{instanceHost(row.original) ?? '-'}</span>
          ),
        }),
        column.accessor((row) => row.publicip ?? '', {
          id: 'publicip',
          header: 'Public IP',
          meta: { className: 'hidden lg:table-cell', headerClassName: 'hidden lg:table-cell' },
          cell: ({ row }) => (
            <span className="font-mono text-xs">{row.original.publicip || '-'}</span>
          ),
        }),
        column.accessor((row) => row.cpu_percent ?? -1, {
          id: 'cpu',
          header: 'CPU',
          meta: { numeric: true },
          cell: ({ row }) =>
            hasMetrics(row.original) ? formatPercent(row.original.cpu_percent) : '-',
        }),
        column.accessor((row) => row.memory_percent ?? -1, {
          id: 'memory',
          header: 'Memory',
          meta: { numeric: true },
          cell: ({ row }) =>
            hasMetrics(row.original) ? formatBytes(row.original.memory_percent) : '-',
        }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          meta: { align: 'right' },
          cell: ({ row }) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for instance ${row.original.instance_number}`}
                >
                  <EllipsisIcon aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={instancePath(row.original.instance_number)}>
                    <ExternalLinkIcon aria-hidden /> Open
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setUndeploying(row.original)}
                >
                  <SquareIcon aria-hidden /> Undeploy
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }),
      ]),
    [instancePath, clusterNames],
  );

  if (service.isPending) {
    return (
      <div className="space-y-4" data-testid="service-loading">
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
        title="Could not load the service"
        error={service.error}
        onRetry={() => void service.refetch()}
      />
    );
  }

  const data = service.data;
  const waiting = data.instance_list.length === 0 && isTransitionalStatus(data.status);
  const noCapacity =
    data.instance_list.length === 0 && describeStatus(data.status).tone === 'warning';
  const virtualization = formatVirtualization(data.virtualization);
  const image = data.image ?? data.code;
  const duplicateTo = addonPath(appId, 'services', data._id, 'duplicate');
  const deployDisabled = deploy.isPending || waiting;

  const deployButton = (
    <Button
      // The alert below explains why deploying will not help yet, so it takes the emphasis.
      variant={noCapacity ? 'outline' : 'default'}
      disabled={deployDisabled}
      onClick={() => deploy.mutate(data._id)}
    >
      <PlayIcon aria-hidden /> Deploy instance
    </Button>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {data.microservice_name}
            <StatusBadge status={data.status} detail={data.status_detail} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {data.microservice_namespace ? <span>{data.microservice_namespace}</span> : null}
            {image ? (
              <span className="inline-flex items-center gap-1">
                <span className="font-mono text-xs">{image}</span>
                <CopyButton value={image} label="Copy image" />
              </span>
            ) : null}
            {virtualization ? <span>{virtualization}</span> : null}
          </span>
        }
        actions={
          <>
            {waiting ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">{deployButton}</span>
                </TooltipTrigger>
                <TooltipContent>
                  Waiting for the scheduler to place the first instance
                </TooltipContent>
              </Tooltip>
            ) : (
              deployButton
            )}
            <Button variant="outline" asChild>
              <Link to={duplicateTo}>
                <CopyIcon aria-hidden /> Duplicate
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <EllipsisIcon aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => downloadJson(`${data.microservice_name}.sla.json`, sla)}
                >
                  <DownloadIcon aria-hidden />
                  <span>
                    Download SLA
                    <span className="block text-xs text-muted-foreground">
                      Includes environment values
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                  <Trash2Icon aria-hidden /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {noCapacity ? (
        <Alert variant="warning">
          <CircleAlertIcon aria-hidden />
          <AlertTitle>No cluster can fit this service</AlertTitle>
          <AlertDescription>
            <p>
              It needs {data.vcpus ?? 0} vCPU
              {data.memory ? ` and ${formatMegabytes(data.memory, 0)} memory` : ''}.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to={duplicateTo}>Duplicate with lower requirements</Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={deploy.isPending}
                onClick={() => deploy.mutate(data._id)}
              >
                Try again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="instances">
            Instances
            <Badge variant="neutral" className="tabular-nums">
              {data.instance_list.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          <Slot
            point="service.detail.tabs"
            context={slotContext}
            render={(extTab, _content, source) => (
              <TabsTrigger value={`${source.id}:${extTab.id}`}>{extTab.label}</TabsTrigger>
            )}
          />
        </TabsList>
        <TabsContent value="overview" className="min-w-0">
          <ServiceOverview
            service={data}
            appId={appId}
            clusterNames={clusterNames}
            onShowInstances={() => setTab('instances')}
          />
        </TabsContent>
        <TabsContent value="instances" className="min-w-0">
          <DataTable
            label="Instances"
            columns={instanceColumns}
            data={data.instance_list}
            getRowId={(row) => String(row.instance_number)}
            hideSearch
            onRowClick={(row) => void navigate(instancePath(row.instance_number))}
            emptyState={
              waiting ? (
                <EmptyState
                  icon={<Loader2Icon className="animate-spin" />}
                  title="Waiting for the scheduler"
                  description="The instance appears here once it is placed on a node."
                />
              ) : noCapacity ? (
                <EmptyState
                  icon={<CircleAlertIcon />}
                  title="No cluster can run this service"
                  description="Lower its requirements or free up capacity, then deploy again."
                  action={deployButton}
                />
              ) : (
                <EmptyState
                  icon={<PlayIcon />}
                  title="No instances"
                  description="Deploy an instance to run this service."
                  action={deployButton}
                />
              )
            }
          />
        </TabsContent>
        <TabsContent value="json" className="min-w-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            Environment values are masked here. Download SLA in the more actions menu includes them.
          </p>
          <JsonViewer title="SLA" data={slaJson} maxHeightClassName="max-h-[32rem]" />
          <JsonViewer
            title="Raw service"
            data={serviceJson}
            defaultOpen={false}
            maxHeightClassName="max-h-[32rem]"
          />
        </TabsContent>
        <Slot
          point="service.detail.tabs"
          context={slotContext}
          render={(extTab, content, source) => (
            <TabsContent value={`${source.id}:${extTab.id}`}>{content}</TabsContent>
          )}
        />
      </Tabs>

      <ConfirmDialog
        open={undeploying !== null}
        onOpenChange={(open) => !open && setUndeploying(null)}
        title={`Undeploy instance ${undeploying?.instance_number ?? ''}?`}
        description="The instance is stopped and removed. The service stays."
        confirmLabel="Undeploy"
        destructive
        pending={undeploy.isPending}
        onConfirm={() => {
          if (!undeploying) return;
          undeploy.mutate(
            { serviceId: data._id, instanceNumber: undeploying.instance_number },
            { onSettled: () => setUndeploying(null) },
          );
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${data.microservice_name}?`}
        description="Its instances are stopped and removed. This cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(data._id, {
            onSuccess: () => void navigate(addonPath(appId), { replace: true }),
            onSettled: () => setDeleting(false),
          })
        }
      />
    </div>
  );
}
