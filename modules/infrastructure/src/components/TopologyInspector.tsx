import { describeStatus, hasMetrics, isAbnormalTone, type Cluster } from '@oakestra/api';
import { useAddonPath, useFeatureEnabled } from '@oakestra/dashboard-sdk';
import {
  Button,
  Card,
  CopyButton,
  formatBytes,
  formatPercent,
  formatRelativeTime,
  plural,
  PointerGauge,
  StatusBadge,
} from '@oakestra/ui';
import { XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { clusterPresentation, clusterUsage } from '../lib';
import { ClusterStatusBadge } from './ClusterStatusBadge';
import {
  clusterNodeId,
  shortWorker,
  UNKNOWN_WORKER,
  workerNodeId,
  type InfraNodeRef,
  type WorkerEntry,
} from '../topology';
import {
  describeLocation,
  sortWorkerInstances,
  summarizeRoot,
  worstProblem,
  workerTitle,
} from '../topology-details';

// Facts and Fact are copies of the ones in modules/fleet/src/components/Inspector.tsx (packages
// cannot import each other); keep the two looking the same.
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
  return <h3 className="text-muted-foreground text-xs font-medium">{children}</h3>;
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-primary text-left hover:underline">
      {children}
    </button>
  );
}

/**
 * Same frame as the application topology's panel (`modules/applications`, TopologyInspector): a
 * small kind label, the title and the status in a divided header, so both graphs read alike.
 * Packages cannot import each other, hence the copy.
 */
function Frame({
  kind,
  title,
  badge,
  onClose,
  children,
}: {
  kind: string;
  title: ReactNode;
  badge?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Card role="region" aria-label="Topology details" className="min-w-0 gap-0 py-0 shadow-xs">
      <div className="flex items-start gap-2 border-b p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-muted-foreground text-xs">{kind}</p>
          <h2 className="text-lg leading-6 font-medium wrap-break-word">{title}</h2>
          {badge}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close details"
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </div>
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </Card>
  );
}

function RootBody({ clusters, onSelect }: { clusters: readonly Cluster[]; onSelect: Select }) {
  const summary = summarizeRoot(clusters);
  return (
    <>
      <Facts>
        <Fact label="Clusters">{summary.total}</Fact>
        <Fact label="Reporting">{summary.reporting}</Fact>
        <Fact label="Not reporting">{summary.silent}</Fact>
        <Fact label="Never reported">{summary.neverReported}</Fact>
        <Fact label="Workers">{summary.workers}</Fact>
      </Facts>
      <p className="text-muted-foreground text-xs">
        Workers are counted on reporting clusters only.
      </p>
      {summary.notReporting.length > 0 ? (
        <section className="space-y-1.5">
          <Heading>Not reporting</Heading>
          <ul className="space-y-1 text-sm">
            {summary.notReporting.map((cluster) => (
              <li key={cluster._id} className="flex items-baseline justify-between gap-3">
                <LinkButton onClick={() => onSelect(clusterNodeId(cluster._id))}>
                  {cluster.cluster_name}
                </LinkButton>
                <span className="text-muted-foreground text-xs">
                  {clusterPresentation(cluster).state === 'silent'
                    ? formatRelativeTime(cluster.last_modified_timestamp)
                    : 'Never reported'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

// The percentage is the mean usage over the workers, the bytes what is left: two separate facts.
function ClusterBody({
  cluster,
  workers,
  onSelect,
}: {
  cluster: Cluster;
  workers: ReadonlyMap<string, WorkerEntry>;
  onSelect: Select;
}) {
  const addonPath = useAddonPath();
  const { state, label } = clusterPresentation(cluster);
  const { cpuPercent, memoryPercent, memoryAvailableBytes, activeNodes, lastKnown } =
    clusterUsage(cluster);
  const location = describeLocation(cluster);
  const lastReport = cluster.last_modified_timestamp;
  const gauge = (name: string, value: number | undefined) =>
    value === undefined ? (
      <span className="text-muted-foreground">No data</span>
    ) : (
      <PointerGauge
        size="sm"
        label={lastKnown ? `${name} (last known)` : name}
        value={value}
        valueLabel={formatPercent(value, 0)}
        // An old report cannot raise an alarm: the cluster may be idle or gone by now.
        {...(lastKnown ? { normalMax: 100 } : {})}
      />
    );
  return (
    <>
      {state === 'never-reported' ? (
        <p className="text-muted-foreground text-sm">
          This cluster registered but has not sent a report yet.
        </p>
      ) : null}
      {lastKnown && state === 'silent' ? (
        <p className="text-muted-foreground text-sm">
          {label} since {formatRelativeTime(lastReport)}. The values below are from its last report.
        </p>
      ) : null}
      <Facts>
        <Fact label="Location">{location}</Fact>
        <Fact label="Workers">{activeNodes}</Fact>
        {state === 'never-reported' ? null : (
          <>
            <Fact label="CPU">{gauge('CPU', cpuPercent)}</Fact>
            <Fact label="Memory">
              {gauge('Memory', memoryPercent)}
              {memoryAvailableBytes === undefined ? null : (
                <span className="text-muted-foreground block text-xs">
                  {formatBytes(memoryAvailableBytes)} available
                </span>
              )}
            </Fact>
          </>
        )}
        <Fact label="Runtimes">{cluster.virtualization.join(', ')}</Fact>
        <Fact label="CSI drivers">{cluster.csi_drivers?.join(', ')}</Fact>
        <Fact label="Last report">{lastReport ? formatRelativeTime(lastReport) : undefined}</Fact>
      </Facts>
      {workers.size > 0 ? (
        <section className="space-y-1.5">
          <Heading>{lastKnown ? 'Workers last seen here' : 'Workers seen here'}</Heading>
          <ul className="space-y-1 text-sm">
            {[...workers].map(([workerId, entry]) => (
              <li key={workerId} className="flex items-baseline justify-between gap-3">
                <LinkButton onClick={() => onSelect(workerNodeId(cluster._id, workerId))}>
                  <span className={workerId === UNKNOWN_WORKER ? undefined : 'font-mono text-xs'}>
                    {workerTitle(workerId)}
                  </span>
                </LinkButton>
                <span className="text-muted-foreground truncate text-xs">
                  {[...entry.services].sort().join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Button asChild className="self-start">
        <Link to={addonPath('clusters', cluster._id)}>Open cluster</Link>
      </Button>
    </>
  );
}

function WorkerBody({
  cluster,
  workerId,
  entry,
  applicationNames,
  onSelect,
}: {
  cluster: Cluster;
  workerId: string;
  entry: WorkerEntry;
  applicationNames: ReadonlyMap<string, string>;
  onSelect: Select;
}) {
  const applicationsEnabled = useFeatureEnabled('applications');
  const known = workerId !== UNKNOWN_WORKER;
  const stale = clusterPresentation(cluster).stale;
  return (
    <>
      <Facts>
        <Fact label="Cluster">
          <LinkButton onClick={() => onSelect(clusterNodeId(cluster._id))}>
            {cluster.cluster_name}
          </LinkButton>
        </Fact>
        {known && workerId !== shortWorker(workerId) ? (
          <Fact label="Worker ID">
            <span className="flex items-start gap-1">
              <span className="font-mono text-xs break-all">{workerId}</span>
              <CopyButton value={workerId} label="Copy worker ID" size="icon-xs" />
            </span>
          </Fact>
        ) : null}
      </Facts>
      {stale ? (
        <p className="text-muted-foreground text-sm">
          {cluster.cluster_name} stopped reporting, so this is the last known state.
        </p>
      ) : null}
      <section className="space-y-1.5">
        <Heading>{plural(entry.instances.length, 'instance')}</Heading>
        <ul className="divide-y rounded-lg border">
          {sortWorkerInstances(entry.instances).map(({ service, instance }) => {
            const status = describeStatus(instance.status);
            const application = service.applicationID
              ? applicationNames.get(service.applicationID)
              : undefined;
            // A failed instance keeps leftover numbers that would read as an idle one.
            const measured = !stale && !isAbnormalTone(status.tone) && hasMetrics(instance);
            return (
              <li
                key={`${service._id}:${instance.instance_number}`}
                className="space-y-0.5 px-3 py-2 text-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  {applicationsEnabled && service.applicationID ? (
                    <Link
                      to={`/applications/${service.applicationID}/services/${service._id}`}
                      className="text-primary min-w-0 truncate hover:underline"
                    >
                      {service.microservice_name}
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate">{service.microservice_name}</span>
                  )}
                  <StatusBadge tone={status.tone} stale={stale} pulse={status.pulse}>
                    {status.label}
                  </StatusBadge>
                </div>
                <div className="text-muted-foreground text-xs">
                  {application ? `${application}, ` : ''}instance {instance.instance_number}
                  {measured
                    ? `, CPU ${formatPercent(instance.cpu_percent ?? 0, 0)}, memory ${formatBytes(instance.memory_percent ?? 0)}`
                    : ''}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

type Select = (nodeId: string) => void;

/**
 * The inspector of the topology: what the selected node is, in more detail than its hover card and
 * with the way on to the cluster page. The look follows modules/fleet/src/components/Inspector.tsx.
 */
export function TopologyInspector({
  target,
  clusters,
  workers,
  applicationNames,
  onSelect,
  onClose,
}: {
  target: InfraNodeRef;
  clusters: readonly Cluster[];
  workers: ReadonlyMap<string, ReadonlyMap<string, WorkerEntry>>;
  applicationNames: ReadonlyMap<string, string>;
  onSelect: Select;
  onClose: () => void;
}) {
  if (target.kind === 'root') {
    return (
      <Frame kind="Orchestrator" title="Root orchestrator" onClose={onClose}>
        <RootBody clusters={clusters} onSelect={onSelect} />
      </Frame>
    );
  }
  const cluster = clusters.find((candidate) => candidate._id === target.clusterId);
  if (!cluster) return null;
  const onCluster = workers.get(cluster._id) ?? new Map<string, WorkerEntry>();
  if (target.kind === 'cluster') {
    return (
      <Frame
        kind="Cluster"
        title={cluster.cluster_name}
        badge={<ClusterStatusBadge cluster={cluster} />}
        onClose={onClose}
      >
        <ClusterBody cluster={cluster} workers={onCluster} onSelect={onSelect} />
      </Frame>
    );
  }
  const entry = onCluster.get(target.workerId);
  if (!entry) return null;
  const problem = worstProblem(entry);
  const worst = sortWorkerInstances(entry.instances)[0];
  return (
    <Frame
      kind="Worker"
      title={
        <span className={target.workerId === UNKNOWN_WORKER ? undefined : 'font-mono'}>
          {workerTitle(target.workerId)}
        </span>
      }
      badge={
        <StatusBadge
          tone={entry.tone}
          stale={clusterPresentation(cluster).stale}
          pulse={entry.pulse}
        >
          {worst ? describeStatus(worst.instance.status).label : 'Idle'}
        </StatusBadge>
      }
      onClose={onClose}
    >
      {problem ? (
        <p className="text-muted-foreground text-sm">
          {problem.status}. {problem.detail}
        </p>
      ) : null}
      <WorkerBody
        cluster={cluster}
        workerId={target.workerId}
        entry={entry}
        applicationNames={applicationNames}
        onSelect={onSelect}
      />
    </Frame>
  );
}
