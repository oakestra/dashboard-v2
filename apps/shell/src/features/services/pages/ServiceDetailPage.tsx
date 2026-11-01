import type { Instance, Service } from '@oakestra/api';
import { useCurrentUser, useOakestraApi } from '@oakestra/dashboard-sdk';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  PlayIcon,
  Trash2Icon,
  UnplugIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { describeError } from '../../../core/api/errors';
import { Slot } from '../../../core/extensions/Slot';
import { JsonViewer } from '../../../components/JsonViewer';
import { downloadJson } from '../../../lib/download';
import { formatBytes, formatPercent } from '../../../lib/format';
import { useDeleteService, useDeployInstance, useUndeployInstance } from '../api/mutations';
import { clustersQuery } from '../../infrastructure';
import { serviceQuery } from '../api/queries';
import { DefinitionList } from '../components/DefinitionList';
import { StatusBadge } from '../components/StatusBadge';
import { serviceToSla } from '../sla';
import { usePollWhileTransitional } from '../status';

const column = createDataTableColumnHelper<Instance>();

function ServiceOverview({ service }: { service: Service }) {
  const addresses = service.addresses;
  const ports = service.port ? service.port.split(';').filter(Boolean) : [];
  const mono = (value: string | undefined) =>
    value ? <span className="font-mono text-xs">{value}</span> : undefined;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <DefinitionList
            items={[
              { label: 'vCPUs', value: service.vcpus },
              { label: 'vGPUs', value: service.vgpus },
              { label: 'vTPUs', value: service.vtpus },
              { label: 'Memory', value: service.memory ? `${service.memory} MB` : undefined },
              { label: 'Storage', value: service.storage ? `${service.storage} MB` : undefined },
              { label: 'Bandwidth in', value: service.bandwidth_in },
              { label: 'Bandwidth out', value: service.bandwidth_out },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Runtime</CardTitle>
        </CardHeader>
        <CardContent>
          <DefinitionList
            items={[
              { label: 'Virtualization', value: service.virtualization },
              { label: 'Image', value: mono(service.image ?? service.code) },
              { label: 'Command', value: mono(service.cmd.join(' ')) },
              { label: 'Arguments', value: mono(service.args.join(' ')) },
              { label: 'Environment', value: mono(service.environment.join('\n')) },
              {
                label: 'Ports',
                value: ports.length ? (
                  <span className="flex flex-col font-mono text-xs">
                    {ports.map((port) => (
                      <span key={port}>{port}</span>
                    ))}
                  </span>
                ) : undefined,
              },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Addresses</CardTitle>
        </CardHeader>
        <CardContent>
          <DefinitionList
            items={[
              {
                label: 'Round robin (IPv4)',
                value: mono(addresses?.rr_ip ?? addresses?.RR_ip ?? service.RR_ip),
              },
              { label: 'Round robin (IPv6)', value: mono(addresses?.rr_ip_v6 ?? service.RR_ip_v6) },
              { label: 'Closest (IPv4)', value: mono(addresses?.closest_ip) },
              { label: 'Closest (IPv6)', value: mono(addresses?.closest_ip_v6) },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Constraints</CardTitle>
        </CardHeader>
        <CardContent>
          {service.constraints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No placement constraints.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {service.constraints.map((constraint, index) => {
                const { type, ...rest } = constraint;
                return (
                  <li key={`${type}-${index}`}>
                    <div className="font-medium">{type}</div>
                    <DefinitionList
                      items={Object.entries(rest).map(([label, value]) => ({
                        label,
                        value: typeof value === 'string' ? value : JSON.stringify(value),
                      }))}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ServiceDetailPage() {
  const { appId = '', serviceId = '' } = useParams();
  const api = useOakestraApi();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const refetchInterval = usePollWhileTransitional();
  const service = useQuery({ ...serviceQuery(api, serviceId), refetchInterval });
  const clusters = useQuery(clustersQuery(api));
  const deploy = useDeployInstance();
  const undeploy = useUndeployInstance();
  const remove = useDeleteService();
  const [deleting, setDeleting] = useState(false);
  const [undeploying, setUndeploying] = useState<Instance | null>(null);

  const clusterNames = useMemo(
    () => new Map((clusters.data ?? []).map((cluster) => [cluster._id, cluster.cluster_name])),
    [clusters.data],
  );

  const instanceColumns = useMemo(
    () =>
      column.columns([
        column.accessor('instance_number', { header: '#' }),
        column.accessor((row) => row.status ?? '', {
          id: 'status',
          header: 'Status',
          cell: ({ row }) => (
            <div>
              <StatusBadge status={row.original.status} />
              {row.original.status_detail ? (
                <div className="mt-1 max-w-48 truncate text-xs text-muted-foreground">
                  {row.original.status_detail}
                </div>
              ) : null}
            </div>
          ),
        }),
        column.accessor(
          (row) => (row.cluster_id ? (clusterNames.get(row.cluster_id) ?? row.cluster_id) : ''),
          { id: 'cluster', header: 'Cluster', cell: (info) => info.getValue() || '-' },
        ),
        column.accessor((row) => row.host_ip ?? row.publicip ?? '', {
          id: 'address',
          header: 'Host / public IP',
          cell: ({ row }) => {
            const { host_ip, host_port, publicip } = row.original;
            const host = host_ip ? (host_port ? `${host_ip}:${host_port}` : host_ip) : undefined;
            return (
              <span className="font-mono text-xs">
                {[host, publicip].filter(Boolean).join(' / ') || '-'}
              </span>
            );
          },
        }),
        column.accessor((row) => row.cpu_percent ?? -1, {
          id: 'cpu',
          header: 'CPU',
          cell: ({ row }) => formatPercent(row.original.cpu_percent),
        }),
        column.accessor((row) => row.memory_percent ?? -1, {
          id: 'memory',
          header: 'Memory',
          cell: ({ row }) => formatBytes(row.original.memory_percent),
        }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon-sm" asChild title="Open">
                <Link
                  aria-label={`Open instance ${row.original.instance_number}`}
                  to={`/applications/${appId}/services/${serviceId}/instances/${row.original.instance_number}`}
                >
                  <ExternalLinkIcon aria-hidden />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Undeploy"
                aria-label={`Undeploy instance ${row.original.instance_number}`}
                onClick={() => setUndeploying(row.original)}
              >
                <UnplugIcon aria-hidden />
              </Button>
            </div>
          ),
        }),
      ]),
    [appId, serviceId, clusterNames],
  );

  if (service.isPending) {
    return (
      <div className="space-y-4" data-testid="service-loading">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (service.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load the service</AlertTitle>
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

  const data = service.data;
  const sla = serviceToSla(data, user?.organization ?? '');

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {data.microservice_name}
            <StatusBadge status={data.status} />
          </span>
        }
        description={
          [data.microservice_namespace, data.image ?? data.code].filter(Boolean).join(' - ') ||
          undefined
        }
        actions={
          <>
            <Button disabled={deploy.isPending} onClick={() => deploy.mutate(data._id)}>
              <PlayIcon aria-hidden /> Deploy instance
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/applications/${appId}/services/${data._id}/duplicate`}>
                <CopyIcon aria-hidden /> Duplicate
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadJson(`${data.microservice_name}.sla.json`, sla)}
            >
              <DownloadIcon aria-hidden /> Export SLA
            </Button>
            <Button variant="outline" onClick={() => setDeleting(true)}>
              <Trash2Icon aria-hidden /> Delete
            </Button>
          </>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="instances">Instances ({data.instance_list.length})</TabsTrigger>
          <TabsTrigger value="sla">SLA</TabsTrigger>
          <Slot
            point="service.detail.tabs"
            context={{ applicationId: appId, serviceId }}
            render={(tab, _content, source) => (
              <TabsTrigger value={`${source.id}:${tab.id}`}>{tab.label}</TabsTrigger>
            )}
          />
        </TabsList>
        <TabsContent value="overview">
          <ServiceOverview service={data} />
        </TabsContent>
        <TabsContent value="instances">
          <DataTable
            label="Instances"
            columns={instanceColumns}
            data={data.instance_list}
            getRowId={(row) => String(row.instance_number)}
            hideSearch
            onRowClick={(row) =>
              void navigate(
                `/applications/${appId}/services/${serviceId}/instances/${row.instance_number}`,
              )
            }
            emptyState={
              <EmptyState
                title="No instances"
                description="Deploy an instance to run this service."
                action={
                  <Button disabled={deploy.isPending} onClick={() => deploy.mutate(data._id)}>
                    Deploy instance
                  </Button>
                }
              />
            }
          />
        </TabsContent>
        <TabsContent value="sla">
          <JsonViewer
            title="Service"
            data={data}
            downloadAs={`${data.microservice_name}.json`}
            maxHeightClassName="max-h-[32rem]"
          />
        </TabsContent>
        <Slot
          point="service.detail.tabs"
          context={{ applicationId: appId, serviceId }}
          render={(tab, content, source) => (
            <TabsContent value={`${source.id}:${tab.id}`}>{content}</TabsContent>
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
            onSuccess: () => void navigate(`/applications/${appId}`, { replace: true }),
            onSettled: () => setDeleting(false),
          })
        }
      />
    </div>
  );
}
