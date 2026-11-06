import type { Cluster, Instance } from '@oakestra/api';
import {
  clustersQuery,
  Slot,
  useAddonPath,
  useCurrentUser,
  useOakestraApi,
} from '@oakestra/dashboard-sdk';
import {
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
  SourceTag,
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
} from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CircleAlertIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  Loader2Icon,
  PlayIcon,
  Trash2Icon,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ContributedTabContent } from '../../components/ContributedTabContent';
import { isNotFound, NotFound } from '../../components/NotFound';
import { seededServiceQuery } from '../../queries';
import { useDeleteService, useDeployInstance, useUndeployInstance } from '../mutations';
import { placementFailureStatus } from '../placement';
import { InstanceItem } from '../components/InstanceItem';
import { ServiceOverview } from '../components/ServiceOverview';
import { StatusBadge } from '../components/StatusBadge';
import { redactEnvironment, redactSlaEnvironment, serviceToSla } from '../sla';
import {
  describeStatus,
  formatVirtualization,
  isTransitionalStatus,
  usePollWhileTransitional,
} from '../status';

const INSTANCE_SORT_OPTIONS: readonly DataListSortOption<Instance>[] = [
  { id: 'number', label: 'Instance number', value: (row) => row.instance_number },
  { id: 'cpu', label: 'Highest CPU', value: (row) => row.cpu_percent ?? -1, desc: true },
  { id: 'memory', label: 'Highest memory', value: (row) => row.memory_percent ?? -1, desc: true },
];

const NO_CLUSTER_NAMES: Readonly<Record<string, string>> = {};

// The cluster list changes with every 30s poll (load figures), but the names rarely do. A plain
// record rather than a Map, because TanStack Query structurally shares `select` results: the names
// keep their identity, so a poll does not re-render the page.
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
  const leaveTab = useCallback((value: string) => {
    setTab((current) => (current === value ? 'overview' : current));
  }, []);

  const clusterNames = clusters.data ?? NO_CLUSTER_NAMES;
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
  const placementFailure = placementFailureStatus(data);
  const virtualization = formatVirtualization(data.virtualization);
  const image = data.image ?? data.code;
  const duplicateTo = addonPath(appId, 'services', data._id, 'duplicate');
  const deployDisabled = deploy.isPending || waiting;

  const deployButton = (
    <Button
      // The placement panel explains why deploying will not help yet, so it takes the emphasis.
      variant={placementFailure ? 'outline' : 'default'}
      disabled={deployDisabled}
      onClick={() => deploy.mutate(data._id)}
    >
      <PlayIcon aria-hidden /> Deploy instance
    </Button>
  );

  return (
    <div className="space-y-6">
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
              <TabsTrigger value={`${source.id}:${extTab.id}`}>
                {extTab.label}
                {source.remote ? (
                  <SourceTag name={source.displayName ?? source.id} version={source.version} />
                ) : null}
              </TabsTrigger>
            )}
          />
        </TabsList>
        <TabsContent value="overview" className="min-w-0">
          <ServiceOverview
            service={data}
            appId={appId}
            clusterNames={clusterNames}
            onShowInstances={() => setTab('instances')}
            onRetryPlacement={() => deploy.mutate(data._id)}
            retryingPlacement={deploy.isPending}
          />
        </TabsContent>
        <TabsContent value="instances" className="min-w-0">
          <DataList
            label="Instances"
            noun="instance"
            data={data.instance_list}
            getRowId={(row) => String(row.instance_number)}
            hideSearch
            sortOptions={INSTANCE_SORT_OPTIONS}
            renderItem={(instance) => (
              <InstanceItem
                instance={instance}
                clusterName={
                  instance.cluster_id
                    ? (clusterNames[instance.cluster_id] ?? instance.cluster_id)
                    : undefined
                }
                href={addonPath(
                  appId,
                  'services',
                  serviceId,
                  'instances',
                  instance.instance_number,
                )}
                onUndeploy={() => setUndeploying(instance)}
              />
            )}
            emptyState={
              waiting ? (
                <EmptyState
                  icon={<Loader2Icon className="animate-spin" />}
                  title="Waiting for the scheduler"
                  description="The instance appears here once it is placed on a node."
                />
              ) : placementFailure ? (
                <EmptyState
                  icon={<CircleAlertIcon />}
                  title={describeStatus(placementFailure).label}
                  description={`${describeStatus(placementFailure).hint}. The Overview tab shows why, cluster by cluster.`}
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
            <ContributedTabContent value={`${source.id}:${extTab.id}`} onRemoved={leaveTab}>
              {content}
            </ContributedTabContent>
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
