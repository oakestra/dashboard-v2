import type { Service } from '@oakestra/api';
import { useAddonPath } from '@oakestra/dashboard-sdk';
import {
  Badge,
  Button,
  SectionCard,
  StatCard,
  StatGroup,
  formatBytes,
  formatMegabytes,
  formatPercent,
} from '@oakestra/ui';
import { ActivityIcon, ChevronRightIcon, CpuIcon, MemoryStickIcon, ServerIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { placementFailureStatus } from '../placement';
import { environmentKeys } from '../sla';
import { describeStatus, hasMetrics, instanceHost, isAbnormalTone } from '../status';
import { DefinitionList } from './DefinitionList';
import { PlacementPanel } from './PlacementPanel';
import { StatusBadge } from './StatusBadge';

const mono = (value: string | undefined) =>
  value ? <span className="font-mono text-xs">{value}</span> : undefined;

const mb = (value: number | undefined) => (value ? formatMegabytes(value, 0) : undefined);

interface OverviewProps {
  service: Service;
  appId: string;
  /** Cluster names by id. */
  clusterNames: Readonly<Record<string, string>>;
  onShowInstances: () => void;
  onRetryPlacement: () => void;
  retryingPlacement: boolean;
}

/** What matters first: are instances running, how loaded, where. The spec comes below. */
function InstanceStats({ service, clusterNames }: Pick<OverviewProps, 'service' | 'clusterNames'>) {
  const instances = service.instance_list;
  const running = instances.filter((i) => describeStatus(i.status).tone === 'success').length;
  const measured = instances.filter(hasMetrics);
  const cpu = measured.length
    ? measured.reduce((sum, i) => sum + (i.cpu_percent ?? 0), 0) / measured.length
    : undefined;
  const memory = measured.length
    ? measured.reduce((sum, i) => sum + (i.memory_percent ?? 0), 0)
    : undefined;
  const clusters = new Set(
    instances.flatMap((i) => (i.cluster_id ? [clusterNames[i.cluster_id] ?? i.cluster_id] : [])),
  );
  const failing = instances.some((i) => isAbnormalTone(describeStatus(i.status).tone));

  return (
    <StatGroup>
      <StatCard
        label="Instances"
        value={instances.length === 0 ? '0' : `${running}/${instances.length}`}
        hint={instances.length === 0 ? 'None deployed' : 'running'}
        icon={<ActivityIcon />}
        tone={failing ? 'warning' : running > 0 ? 'success' : 'default'}
      />
      <StatCard
        label="CPU"
        value={formatPercent(cpu)}
        hint={measured.length > 1 ? 'average' : undefined}
        icon={<CpuIcon />}
      />
      <StatCard
        label="Memory"
        value={formatBytes(memory)}
        hint={measured.length > 1 ? 'total' : undefined}
        icon={<MemoryStickIcon />}
      />
      <StatCard
        label="Clusters"
        value={clusters.size || '-'}
        hint={clusters.size ? [...clusters].join(', ') : undefined}
        icon={<ServerIcon />}
      />
    </StatGroup>
  );
}

function InstancePreview({ service, appId, clusterNames, onShowInstances }: OverviewProps) {
  const addonPath = useAddonPath();
  const rows = service.instance_list.slice(0, 5);
  return (
    <SectionCard
      title="Instances"
      description={
        service.instance_list.length > rows.length
          ? `Showing ${rows.length} of ${service.instance_list.length}.`
          : undefined
      }
      action={
        service.instance_list.length > 0 ? (
          <Button variant="outline" size="sm" onClick={onShowInstances}>
            View all
          </Button>
        ) : undefined
      }
      flush
    >
      {rows.length === 0 ? (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">No instances yet.</p>
      ) : (
        <ul className="divide-y border-t">
          {rows.map((instance) => (
            <li key={instance.instance_number}>
              <Link
                to={addonPath(
                  appId,
                  'services',
                  service._id,
                  'instances',
                  instance.instance_number,
                )}
                className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
              >
                <span className="w-8 font-medium tabular-nums">#{instance.instance_number}</span>
                <StatusBadge status={instance.status} detail={instance.status_detail} />
                <span className="text-muted-foreground">
                  {instance.cluster_id
                    ? (clusterNames[instance.cluster_id] ?? instance.cluster_id)
                    : '-'}
                </span>
                <span className="font-mono text-xs text-muted-foreground sm:ml-auto">
                  {instanceHost(instance) ?? '-'}
                </span>
                <ChevronRightIcon
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground/60 group-hover:text-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function Constraints({ service }: { service: Service }) {
  return (
    <ul className="space-y-2 text-sm">
      {service.constraints.map((constraint, index) => {
        const { type, ...rest } = constraint;
        return (
          <li key={`${type}-${index}`}>
            <div className="mb-1 font-medium">{type}</div>
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
  );
}

export function ServiceOverview(props: OverviewProps) {
  const { service } = props;
  const addresses = service.addresses;
  const ports = service.port ? service.port.split(';').filter(Boolean) : [];
  const envKeys = environmentKeys(service.environment);
  const addressItems = [
    {
      label: 'Round robin (IPv4)',
      value: mono(addresses?.rr_ip ?? addresses?.RR_ip ?? service.RR_ip),
    },
    { label: 'Round robin (IPv6)', value: mono(addresses?.rr_ip_v6 ?? service.RR_ip_v6) },
    { label: 'Closest (IPv4)', value: mono(addresses?.closest_ip) },
    { label: 'Closest (IPv6)', value: mono(addresses?.closest_ip_v6) },
  ];
  const hasAddresses = addressItems.some((item) => item.value);
  const hasConstraints = service.constraints.length > 0;

  return (
    <div className="space-y-4">
      <InstanceStats service={service} clusterNames={props.clusterNames} />
      {placementFailureStatus(service) ? (
        // Keyed because the what-if limits start from this service's request.
        <PlacementPanel
          key={service._id}
          service={service}
          appId={props.appId}
          onRetry={props.onRetryPlacement}
          retrying={props.retryingPlacement}
        />
      ) : null}
      {service.instance_list.length > 0 ? <InstancePreview {...props} /> : null}
      <SectionCard title="Specification">
        <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
          <PanelBlock title="Requirements">
            <DefinitionList
              items={[
                { label: 'vCPUs', value: service.vcpus || undefined },
                { label: 'vGPUs', value: service.vgpus || undefined },
                { label: 'vTPUs', value: service.vtpus || undefined },
                { label: 'Memory', value: mb(service.memory) },
                { label: 'Storage', value: mb(service.storage) },
                {
                  label: 'Bandwidth in',
                  value: service.bandwidth_in ? `${service.bandwidth_in} kbit/s` : undefined,
                },
                {
                  label: 'Bandwidth out',
                  value: service.bandwidth_out ? `${service.bandwidth_out} kbit/s` : undefined,
                },
              ]}
            />
          </PanelBlock>
          <PanelBlock title="Runtime">
            <DefinitionList
              items={[
                { label: 'Command', value: mono(service.cmd.join(' ')) },
                { label: 'Arguments', value: mono(service.args.join(' ')) },
                {
                  // Keys only: the values may be secrets.
                  label: 'Environment',
                  value: envKeys.length ? (
                    <span className="flex flex-wrap gap-1" data-testid="environment-keys">
                      {envKeys.map((key) => (
                        <Badge key={key} variant="outline" className="font-mono">
                          {key}
                        </Badge>
                      ))}
                    </span>
                  ) : undefined,
                },
                {
                  label: 'Ports',
                  value: ports.length ? (
                    <span className="flex flex-wrap gap-1">
                      {ports.map((port) => (
                        <Badge key={port} variant="outline" className="font-mono">
                          {formatPort(port)}
                        </Badge>
                      ))}
                    </span>
                  ) : undefined,
                },
              ]}
              empty="No command, arguments, environment or ports set."
            />
          </PanelBlock>
          <PanelBlock title="Networking and placement" className="border-t pt-4 lg:col-span-2">
            <div className="space-y-3">
              {hasAddresses ? <DefinitionList items={addressItems} /> : null}
              {hasConstraints ? <Constraints service={service} /> : null}
              {!hasAddresses && !hasConstraints ? (
                <p className="text-sm text-muted-foreground">
                  Oakestra allocates addresses and may place this service on any cluster.
                </p>
              ) : null}
            </div>
          </PanelBlock>
        </div>
      </SectionCard>
    </div>
  );
}

function PanelBlock({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

/** `8081:80/tcp` becomes `8081 -> 80/tcp`; anything else is shown as is. */
function formatPort(port: string): string {
  const match = /^(\d+):(\d+)(\/\w+)?$/.exec(port);
  return match ? `${match[1]} -> ${match[2]}${match[3] ?? ''}` : port;
}
