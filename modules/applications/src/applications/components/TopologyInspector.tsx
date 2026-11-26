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
  Fact,
  FactList,
  formatBytes,
  formatPercent,
  formatRelativeTime,
  InspectorPanel,
  InspectorSection,
  plural,
  PointerGauge,
  StatusBadge,
  StatusDot,
} from '@oakestra/ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { INFRASTRUCTURE_ROLES } from '../../services/infrastructure-roles';
import { describeStatus, isAbnormalTone } from '../../services/status';
import {
  clusterAttention,
  clusterIsReporting,
  isMeasured,
  lastReportLine,
  placementAttention,
  summarizeSelection,
  worstInstance,
  type TopologyAttention,
  type TopologySelection,
} from '../topology-details';
import {
  clusterDisplayName,
  clusterGroupId,
  instancesByCluster,
  notRunningReason,
  notRunningTone,
  placementNodeId,
} from '../topology';

const linkButtonClassName = 'text-left text-primary hover:underline';

/**
 * The reason to act, above everything else in the body. The glyph carries the tone, the text stays
 * neutral, so the panel does not turn into a colored box.
 */
function Attention({ attention, href }: { attention: TopologyAttention; href?: string }) {
  return (
    <div className="flex gap-2.5 text-sm">
      <StatusDot tone={attention.tone} className="mt-1.5" />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">{attention.headline}</p>
        {attention.reason ? (
          <p className="wrap-break-word text-muted-foreground">{attention.reason}</p>
        ) : null}
        {/* The instance page has the logs, which is the next thing anyone reading the reason needs. */}
        {href && attention.instanceNumber !== undefined ? (
          <p>
            <Link to={href} className="text-primary hover:underline">
              Open instance {attention.instanceNumber}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

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
        const metrics = isMeasured(instance, reporting);
        return (
          <li key={instance.instance_number} className="space-y-0.5 px-3 py-2 text-sm">
            <div className="flex items-center gap-2.5">
              <StatusDot tone={status.tone} pulse={status.pulse} stale={!reporting} />
              <span className="min-w-0 flex-1 truncate">
                <Link
                  to={addonPath(
                    application._id,
                    'services',
                    service._id,
                    'instances',
                    String(instance.instance_number),
                  )}
                  className="text-primary hover:underline"
                  aria-label={`Open instance ${instance.instance_number}`}
                >
                  Instance {instance.instance_number}
                </Link>
              </span>
              <span className="text-xs whitespace-nowrap text-muted-foreground">
                {status.label}
              </span>
            </div>
            {instance.worker_id || metrics ? (
              <div className="flex flex-wrap items-baseline gap-x-3 pl-[1.125rem] text-xs text-muted-foreground">
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
              </div>
            ) : null}
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
    <InspectorSection title={title}>
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
    </InspectorSection>
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
  clusters: readonly Cluster[];
  onSelect: (id: string) => void;
}

function PlacementBody({
  selection,
  application,
  clusters,
  onSelect,
}: BodyProps & { selection: Extract<TopologySelection, { kind: 'placement' }> }) {
  const { service, clusterId, clusterName, cluster, instances, calls, calledBy } = selection;
  const addonPath = useAddonPath();
  const reporting = clusterIsReporting(cluster);
  const attention = placementAttention(instances);
  const nameOfCluster = (id: string) =>
    clusterDisplayName(
      id,
      clusters.find((c) => c._id === id),
    );
  const otherClusters = [...instancesByCluster(service).keys()].filter((id) => id !== clusterId);
  return (
    <>
      {attention ? (
        <Attention
          attention={attention}
          href={
            attention.instanceNumber === undefined
              ? undefined
              : addonPath(
                  application._id,
                  'services',
                  service._id,
                  'instances',
                  String(attention.instanceNumber),
                )
          }
        />
      ) : null}
      <FactList>
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
      </FactList>
      <InspectorSection title={`${plural(instances.length, 'instance')} here`}>
        <InstanceRows
          application={application}
          service={service}
          instances={instances}
          reporting={reporting}
        />
      </InspectorSection>
      {otherClusters.length > 0 ? (
        <InspectorSection title="Also runs on">
          <ul className="space-y-1 text-sm">
            {otherClusters.map((id) => (
              <li key={id}>
                <SelectButton id={placementNodeId(service._id, id)} onSelect={onSelect}>
                  {nameOfCluster(id)}
                </SelectButton>
              </li>
            ))}
          </ul>
        </InspectorSection>
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
    </>
  );
}

function UnplacedServiceBody({
  selection,
}: {
  selection: Extract<TopologySelection, { kind: 'unplaced-service' }>;
}) {
  const { service } = selection;
  const detail = schedulerDetail(service.status_detail);
  return (
    <>
      <FactList>
        <Fact label="Scheduler">{detail}</Fact>
      </FactList>
      <p className="text-sm text-muted-foreground">
        Nothing runs yet. The service page explains what each cluster is missing.
      </p>
    </>
  );
}

function ClusterBody({
  selection,
  onSelect,
}: BodyProps & { selection: Extract<TopologySelection, { kind: 'cluster' }> }) {
  const { cluster, clusterId } = selection;
  const reporting = clusterIsReporting(cluster);
  const cpu = cluster ? clusterCpuPercent(cluster) : undefined;
  const attention = clusterAttention(selection);
  return (
    <>
      {attention ? <Attention attention={attention} /> : null}
      {cluster && !reporting ? (
        <p className="text-sm text-muted-foreground">
          {lastReportLine(cluster)}. Its load is not shown, it is too old to trust.
        </p>
      ) : null}
      <FactList>
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
      </FactList>
      <InspectorSection title="Services of this application">
        <ServiceRows services={selection.services} clusterId={clusterId} onSelect={onSelect} />
      </InspectorSection>
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
  clusters: readonly Cluster[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** The way on from the selected node, or `null` when there is none for this kind or viewer. */
function usePrimaryAction(selection: TopologySelection, application: Application): ReactNode {
  const addonPath = useAddonPath();
  const infrastructure = useFeatureEnabled('infrastructure');
  const permissions = usePermissions();
  switch (selection.kind) {
    case 'placement':
    case 'unplaced-service':
      return (
        <Link to={addonPath(application._id, 'services', selection.service._id)}>Open service</Link>
      );
    case 'cluster':
      return infrastructure && permissions.hasAnyRole(INFRASTRUCTURE_ROLES) ? (
        <Link to={`/infrastructure/clusters/${encodeURIComponent(selection.clusterId)}`}>
          Open cluster
        </Link>
      ) : null;
    case 'unplaced':
      return null;
  }
}

/**
 * Details of the selected node. FlowGraph floats it over the graph's right edge (below the graph on
 * narrow screens), so the graph keeps its size and walking from node to node is one click.
 */
export function TopologyInspector({ selection, onClose, ...body }: TopologyInspectorProps) {
  const summary = summarizeSelection(selection);
  const action = usePrimaryAction(selection, body.application);
  return (
    <InspectorPanel
      kind={summary.kind}
      title={summary.title}
      status={
        <StatusBadge tone={summary.tone} stale={summary.stale}>
          {summary.statusLabel}
        </StatusBadge>
      }
      footer={action ? <Button asChild>{action}</Button> : null}
      onClose={onClose}
    >
      {selection.kind === 'placement' ? (
        <PlacementBody selection={selection} {...body} />
      ) : selection.kind === 'unplaced-service' ? (
        <UnplacedServiceBody selection={selection} />
      ) : selection.kind === 'cluster' ? (
        <ClusterBody selection={selection} {...body} />
      ) : (
        <UnplacedBody selection={selection} {...body} />
      )}
    </InspectorPanel>
  );
}

/** Preview shown while hovering a node: what the node itself does not say, no actions. */
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
