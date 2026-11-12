import {
  clusterCpuPercent,
  parseClusterLocation,
  schedulerDetail,
  type Application,
  type Cluster,
  type Instance,
  type Service,
} from '@oakestra/api';
import { useAddonPath, useFeatureEnabled, usePermissions } from '@oakestra/dashboard-sdk';
import {
  Button,
  Card,
  formatBytes,
  formatPercent,
  formatRelativeTime,
  plural,
  PointerGauge,
  StatusBadge,
  StatusDot,
} from '@oakestra/ui';
import { XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { INFRASTRUCTURE_ROLES } from '../../services/infrastructure-roles';
import { describeStatus, hasMetrics, isAbnormalTone } from '../../services/status';
import {
  clusterIsReporting,
  summarizeSelection,
  worstInstance,
  type TopologySelection,
} from '../topology-details';
import {
  clusterDisplayName,
  clusterGroupId,
  connectivityLinks,
  instancesByCluster,
  notRunningReason,
  notRunningTone,
  placementNodeId,
} from '../topology';

// The look of the fleet inspector (modules/fleet). Packages cannot import each other, so the few
// pieces needed here are copies.
function Facts({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">{children}</dl>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  if (children === undefined || children === null || children === '') return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 wrap-break-word">{children}</dd>
    </>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-medium text-muted-foreground">{children}</h3>;
}

const linkButtonClassName = 'text-left text-primary hover:underline';

function SelectButton({
  id,
  onSelect,
  children,
}: {
  id: string;
  onSelect: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={() => onSelect(id)} className={linkButtonClassName}>
      {children}
    </button>
  );
}

/** Every service row of a list that selects its placement (or its "not running" node). */
function ServiceRows({
  services,
  clusterId,
  onSelect,
}: {
  services: readonly Service[];
  /** The cluster the rows belong to; `null` for the services that run nowhere. */
  clusterId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="divide-y rounded-lg border">
      {services.map((service) => {
        const status =
          clusterId === null
            ? { tone: notRunningTone(service), label: notRunningReason(service), pulse: false }
            : describeStatus(
                worstInstance(instancesByCluster(service).get(clusterId) ?? [])?.status,
              );
        return (
          <li key={service._id}>
            <button
              type="button"
              onClick={() => onSelect(placementNodeId(service._id, clusterId))}
              className="flex min-h-11 w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
              <StatusDot tone={status.tone} pulse={status.pulse} />
              <span className="min-w-0 flex-1 truncate">{service.microservice_name}</span>
              <span className="text-xs whitespace-nowrap text-muted-foreground">
                {status.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function InstanceRows({
  application,
  service,
  instances,
  reporting,
}: {
  application: Application;
  service: Service;
  instances: readonly Instance[];
  reporting: boolean;
}) {
  const addonPath = useAddonPath();
  return (
    <ul className="divide-y rounded-lg border">
      {instances.map((instance) => {
        const status = describeStatus(instance.status);
        const metrics = reporting && hasMetrics(instance);
        return (
          <li key={instance.instance_number} className="space-y-0.5 px-3 py-2 text-sm">
            <div className="flex items-center gap-2.5">
              <StatusDot tone={status.tone} pulse={status.pulse} stale={!reporting} />
              <span className="min-w-0 flex-1">Instance {instance.instance_number}</span>
              <span className="text-xs text-muted-foreground">{status.label}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 pl-[1.375rem] text-xs text-muted-foreground">
              {instance.worker_id ? (
                <span className="font-mono" title={instance.worker_id}>
                  {shortWorker(instance.worker_id)}
                </span>
              ) : null}
              {metrics ? (
                <>
                  <span>CPU {formatPercent(instance.cpu_percent)}</span>
                  <span>Memory {formatBytes(instance.memory_percent)}</span>
                </>
              ) : null}
              <Link
                to={addonPath(
                  application._id,
                  'services',
                  service._id,
                  'instances',
                  String(instance.instance_number),
                )}
                className="ml-auto text-primary hover:underline"
                aria-label={`Open instance ${instance.instance_number}`}
              >
                Open instance
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The placement a link should select: in the same cluster when it runs there. */
function placementIdNear(targetId: string, near: readonly string[], clusterId: string | null) {
  const chosen = clusterId !== null && near.includes(clusterId) ? clusterId : (near[0] ?? null);
  return placementNodeId(targetId, chosen);
}

function Relations({
  title,
  services,
  clusterId,
  clusterName,
  onSelect,
}: {
  title: string;
  services: readonly Service[];
  clusterId: string;
  clusterName: (id: string) => string;
  onSelect: (id: string) => void;
}) {
  if (services.length === 0) return null;
  return (
    <section className="space-y-1.5">
      <Heading>{title}</Heading>
      <ul className="space-y-1 text-sm">
        {services.map((target) => {
          const near = [...instancesByCluster(target).keys()];
          const elsewhere = near.length > 0 && !near.includes(clusterId);
          return (
            <li key={target._id}>
              <SelectButton id={placementIdNear(target._id, near, clusterId)} onSelect={onSelect}>
                {target.microservice_name}
              </SelectButton>
              {elsewhere ? (
                <span className="text-muted-foreground"> on {clusterName(near[0]!)}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Worker ids share a long prefix, so the tail is what tells them apart; the same rule as
// `shortWorker` in modules/infrastructure/src/topology.ts, which the graph labels use.
function shortWorker(workerId: string): string {
  return workerId.length > 10 ? workerId.slice(-6) : workerId;
}

// Same wording as the infrastructure topology's panel (`describeLocation` in
// modules/infrastructure/src/topology-details.ts); packages cannot import each other.
function coordinates(location: string | undefined): string | undefined {
  const parsed = parseClusterLocation(location);
  if (!parsed) return undefined;
  const lat = `${Math.abs(parsed.latitude).toFixed(2)}° ${parsed.latitude < 0 ? 'S' : 'N'}`;
  const lng = `${Math.abs(parsed.longitude).toFixed(2)}° ${parsed.longitude < 0 ? 'W' : 'E'}`;
  const radius = parsed.radius ? `, radius ${parsed.radius} km` : '';
  return `${lat}, ${lng}${radius}`;
}

interface BodyProps {
  application: Application;
  services: readonly Service[];
  clusters: readonly Cluster[];
  onSelect: (id: string) => void;
}

function PlacementBody({
  selection,
  application,
  services,
  clusters,
  onSelect,
}: BodyProps & { selection: Extract<TopologySelection, { kind: 'placement' }> }) {
  const addonPath = useAddonPath();
  const { service, clusterId, clusterName, cluster, instances } = selection;
  const reporting = clusterIsReporting(cluster);
  const nameOfCluster = (id: string) =>
    clusterDisplayName(
      id,
      clusters.find((c) => c._id === id),
    );
  const otherClusters = [...instancesByCluster(service).keys()].filter((id) => id !== clusterId);
  const links = connectivityLinks(services);
  const calls = links.filter(([from]) => from._id === service._id).map(([, to]) => to);
  const calledBy = links.filter(([, to]) => to._id === service._id).map(([from]) => from);
  return (
    <>
      <Facts>
        <Fact label="Cluster">
          <SelectButton id={clusterGroupId(clusterId)} onSelect={onSelect}>
            {clusterName}
          </SelectButton>
          {reporting ? null : (
            <span className="block text-xs text-muted-foreground">
              Stopped reporting, so states are the last known ones.
            </span>
          )}
        </Fact>
      </Facts>
      <section className="space-y-1.5">
        <Heading>{plural(instances.length, 'instance')} here</Heading>
        <InstanceRows
          application={application}
          service={service}
          instances={instances}
          reporting={reporting}
        />
      </section>
      {otherClusters.length > 0 ? (
        <section className="space-y-1.5">
          <Heading>Also runs on</Heading>
          <ul className="space-y-1 text-sm">
            {otherClusters.map((id) => (
              <li key={id}>
                <SelectButton id={placementNodeId(service._id, id)} onSelect={onSelect}>
                  {nameOfCluster(id)}
                </SelectButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Relations
        title="Calls"
        services={calls}
        clusterId={clusterId}
        clusterName={nameOfCluster}
        onSelect={onSelect}
      />
      <Relations
        title="Called by"
        services={calledBy}
        clusterId={clusterId}
        clusterName={nameOfCluster}
        onSelect={onSelect}
      />
      <Button asChild className="self-start">
        <Link to={addonPath(application._id, 'services', service._id)}>Open service</Link>
      </Button>
    </>
  );
}

function UnplacedServiceBody({
  selection,
  application,
}: {
  selection: Extract<TopologySelection, { kind: 'unplaced-service' }>;
  application: Application;
}) {
  const addonPath = useAddonPath();
  const { service } = selection;
  const detail = schedulerDetail(service.status_detail);
  return (
    <>
      <Facts>
        <Fact label="Scheduler">{detail}</Fact>
      </Facts>
      <p className="text-sm text-muted-foreground">
        Nothing runs yet. The service page explains what each cluster is missing.
      </p>
      <Button asChild className="self-start">
        <Link to={addonPath(application._id, 'services', service._id)}>Open service</Link>
      </Button>
    </>
  );
}

function ClusterBody({
  selection,
  onSelect,
}: BodyProps & { selection: Extract<TopologySelection, { kind: 'cluster' }> }) {
  const infrastructure = useFeatureEnabled('infrastructure');
  const permissions = usePermissions();
  const canOpen = infrastructure && permissions.hasAnyRole(INFRASTRUCTURE_ROLES);
  const { cluster, clusterId } = selection;
  const reporting = clusterIsReporting(cluster);
  const cpu = cluster ? clusterCpuPercent(cluster) : undefined;
  return (
    <>
      {cluster && !reporting ? (
        <p className="text-sm text-muted-foreground">
          {cluster.last_modified_timestamp
            ? `Last report ${formatRelativeTime(cluster.last_modified_timestamp)}. `
            : 'It has not sent a report yet. '}
          Its values are not shown, they are too old to trust.
        </p>
      ) : null}
      <Facts>
        <Fact label="Location">{coordinates(cluster?.cluster_location)}</Fact>
        {cluster && reporting ? (
          <>
            <Fact label="Workers">{cluster.active_nodes ?? 0}</Fact>
            <Fact label="CPU">
              {cpu === undefined ? undefined : (
                <PointerGauge
                  size="sm"
                  label="CPU"
                  value={cpu}
                  valueLabel={formatPercent(cpu, 0)}
                />
              )}
            </Fact>
            {/* Mean over the workers, not a share of a capacity. */}
            <Fact label="Memory">
              {cluster.memory_percent === undefined ? undefined : (
                <PointerGauge
                  size="sm"
                  label="Memory"
                  value={cluster.memory_percent}
                  valueLabel={formatPercent(cluster.memory_percent, 0)}
                />
              )}
            </Fact>
            <Fact label="Last report">
              {cluster.last_modified_timestamp
                ? formatRelativeTime(cluster.last_modified_timestamp)
                : undefined}
            </Fact>
          </>
        ) : null}
      </Facts>
      <section className="space-y-1.5">
        <Heading>Services of this application</Heading>
        <ServiceRows services={selection.services} clusterId={clusterId} onSelect={onSelect} />
      </section>
      {canOpen ? (
        <Button asChild className="self-start">
          <Link to={`/infrastructure/clusters/${encodeURIComponent(clusterId)}`}>Open cluster</Link>
        </Button>
      ) : null}
    </>
  );
}

function UnplacedBody({
  selection,
  onSelect,
}: BodyProps & { selection: Extract<TopologySelection, { kind: 'unplaced' }> }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        These services have no instance on any cluster. Select one to see why.
      </p>
      <ServiceRows services={selection.services} clusterId={null} onSelect={onSelect} />
    </>
  );
}

interface TopologyInspectorProps {
  selection: TopologySelection;
  application: Application;
  services: readonly Service[];
  clusters: readonly Cluster[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * Details of the selected node. FlowGraph floats it over the graph's right edge (below the graph on
 * narrow screens), so the graph keeps its size and walking from node to node is one click.
 */
export function TopologyInspector({ selection, onClose, ...body }: TopologyInspectorProps) {
  const summary = summarizeSelection(selection);
  return (
    <Card
      role="region"
      aria-label={`Details of ${summary.title}`}
      className="min-w-0 gap-0 py-0 shadow-xs"
    >
      <div className="flex items-start gap-2 border-b p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">{summary.kind}</p>
          <h2 className="text-lg leading-6 font-medium wrap-break-word">{summary.title}</h2>
          <StatusBadge tone={summary.tone} stale={summary.stale}>
            {summary.statusLabel}
          </StatusBadge>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close details" onClick={onClose}>
          <XIcon aria-hidden />
        </Button>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {selection.kind === 'placement' ? (
          <PlacementBody selection={selection} {...body} />
        ) : selection.kind === 'unplaced-service' ? (
          <UnplacedServiceBody selection={selection} application={body.application} />
        ) : selection.kind === 'cluster' ? (
          <ClusterBody selection={selection} {...body} />
        ) : (
          <UnplacedBody selection={selection} {...body} />
        )}
      </div>
    </Card>
  );
}

/** Preview shown while hovering a node: the same facts as the top of the panel, no actions. */
export function TopologyHoverCard({ selection }: { selection: TopologySelection }) {
  const summary = summarizeSelection(selection);
  return (
    <div className="space-y-1">
      <p className="font-medium wrap-break-word">{summary.title}</p>
      <p className={isAbnormalTone(summary.tone) ? 'text-foreground' : 'text-muted-foreground'}>
        {summary.statusLabel}
      </p>
      {summary.lines.map((line) => (
        <p key={line} className="text-muted-foreground wrap-break-word">
          {line}
        </p>
      ))}
    </div>
  );
}
