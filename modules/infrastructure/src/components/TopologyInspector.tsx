import { describeStatus, hasMetrics, isAbnormalTone, type Cluster } from '@oakestra/api';
import { useAddonPath, useFeatureEnabled } from '@oakestra/dashboard-sdk';
import {
  Button,
  CopyButton,
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
} from '@oakestra/ui';
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
  describeFailures,
  describeLocation,
  failedOnCluster,
  sortWorkerInstances,
  summarizeRoot,
  worstProblem,
  workerTitle,
  workerUsage,
} from '../topology-details';

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-primary text-left hover:underline">
      {children}
    </button>
  );
}

function RootBody({ clusters, onSelect }: { clusters: readonly Cluster[]; onSelect: Select }) {
  const summary = summarizeRoot(clusters);
  return (
    <>
      <FactList>
        <Fact label="Clusters">{summary.total}</Fact>
        <Fact label="Reporting">{summary.reporting}</Fact>
        <Fact label="Not reporting">{summary.silent}</Fact>
        <Fact label="Never reported">{summary.neverReported}</Fact>
        <Fact label="Workers">{summary.workers}</Fact>
      </FactList>
      <p className="text-muted-foreground text-xs">
        Workers are counted on reporting clusters only.
      </p>
      {summary.notReporting.length > 0 ? (
        <InspectorSection title="Not reporting">
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
        </InspectorSection>
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
  const { state, label } = clusterPresentation(cluster);
  const failures = describeFailures(failedOnCluster(workers));
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
      {failures ? <p className="text-sm">{failures} Select a worker below to see why.</p> : null}
      {state === 'never-reported' ? (
        <p className="text-muted-foreground text-sm">
          This cluster registered but has not sent a report yet.
        </p>
      ) : null}
      {lastKnown && state === 'silent' ? (
        <p className="text-muted-foreground text-sm">
          {label}, last report {formatRelativeTime(lastReport)}. The values below are from that
          report.
        </p>
      ) : null}
      <FactList>
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
      </FactList>
      {workers.size > 0 ? (
        <InspectorSection title={lastKnown ? 'Workers last seen here' : 'Workers seen here'}>
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
        </InspectorSection>
      ) : null}
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
  const usage = workerUsage(entry, stale);
  return (
    <>
      <FactList>
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
        <Fact label="Instances">{entry.instances.length}</Fact>
        <Fact label="Services">{[...entry.services].sort().join(', ')}</Fact>
        <Fact label="CPU in use">{usage ? formatPercent(usage.cpuPercent, 0) : undefined}</Fact>
        <Fact label="Memory in use">{usage ? formatBytes(usage.memoryBytes) : undefined}</Fact>
      </FactList>
      {stale ? (
        <p className="text-muted-foreground text-sm">
          {cluster.cluster_name} stopped reporting, so this is the last known state.
        </p>
      ) : null}
      <InspectorSection title={plural(entry.instances.length, 'instance')}>
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
      </InspectorSection>
    </>
  );
}

type Select = (nodeId: string) => void;

/**
 * The inspector of the topology: what the selected node is, in more detail than its hover card and
 * with the way on to the cluster page.
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
  const addonPath = useAddonPath();
  if (target.kind === 'root') {
    return (
      <InspectorPanel kind="Orchestrator" title="Root orchestrator" onClose={onClose}>
        <RootBody clusters={clusters} onSelect={onSelect} />
      </InspectorPanel>
    );
  }
  const cluster = clusters.find((candidate) => candidate._id === target.clusterId);
  if (!cluster) return null;
  const onCluster = workers.get(cluster._id) ?? new Map<string, WorkerEntry>();
  // The placeholder stands for no worker, so its panel is the cluster's.
  if (target.kind === 'cluster' || target.kind === 'rest') {
    return (
      <InspectorPanel
        kind="Cluster"
        title={cluster.cluster_name}
        status={<ClusterStatusBadge cluster={cluster} />}
        footer={
          <Button asChild>
            <Link to={addonPath('clusters', cluster._id)}>Open cluster</Link>
          </Button>
        }
        onClose={onClose}
      >
        <ClusterBody cluster={cluster} workers={onCluster} onSelect={onSelect} />
      </InspectorPanel>
    );
  }
  const entry = onCluster.get(target.workerId);
  if (!entry) return null;
  const problem = worstProblem(entry);
  const worst = sortWorkerInstances(entry.instances)[0];
  return (
    <InspectorPanel
      kind="Worker"
      name={workerTitle(target.workerId)}
      title={
        <span className={target.workerId === UNKNOWN_WORKER ? undefined : 'font-mono'}>
          {workerTitle(target.workerId)}
        </span>
      }
      status={
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
    </InspectorPanel>
  );
}
