import type { Cluster } from '@oakestra/api';
import { useAddonPath, useSearchParam } from '@oakestra/dashboard-sdk';
import {
  Badge,
  Card,
  PointerGauge,
  cn,
  formatBytes,
  formatPercent,
  formatRelativeTime,
  plural,
  staleSurfaceClassName,
  stretchedLinkClassName,
} from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { type ReactNode } from 'react';
import { Link } from 'react-router';

import { clusterPresentation, clusterUsage } from '../lib';
import { ClusterStatusBadge } from './ClusterStatusBadge';

const searchValue = (cluster: Cluster) =>
  [cluster.cluster_name, clusterPresentation(cluster).label, ...cluster.virtualization].join(' ');

// -1 keeps a cluster without a figure below one that really reports zero.
const SORT_OPTIONS: readonly DataListSortOption<Cluster>[] = [
  { id: 'name', label: 'Name', value: (cluster) => cluster.cluster_name },
  { id: 'status', label: 'Active first', value: (cluster) => (cluster.active ? 0 : 1) },
  {
    id: 'nodes',
    label: 'Most active nodes',
    value: (cluster) => clusterUsage(cluster).activeNodes ?? -1,
    desc: true,
  },
  {
    id: 'cpu',
    label: 'Highest CPU usage',
    value: (cluster) => clusterUsage(cluster).cpuPercent ?? -1,
    desc: true,
  },
  {
    id: 'memory',
    label: 'Highest memory usage',
    value: (cluster) => clusterUsage(cluster).memoryPercent ?? -1,
    desc: true,
  },
  {
    id: 'gpu',
    label: 'Most GPU cores',
    value: (cluster) => cluster.total_gpu_cores ?? 0,
    desc: true,
  },
  {
    id: 'last-seen',
    label: 'Recently seen',
    value: (cluster) => cluster.last_modified_timestamp?.getTime() ?? 0,
    desc: true,
  },
];

function LastKnown({ lastKnown, children }: { lastKnown: boolean; children: ReactNode }) {
  if (!lastKnown) return children;
  return (
    <>
      {children}
      <span className="sr-only"> (last known)</span>
    </>
  );
}

function Meter({
  label,
  percent,
  lastKnown,
}: {
  label: string;
  percent: number | undefined;
  lastKnown: boolean;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <PointerGauge
          size="sm"
          label={lastKnown ? `${label} (last known)` : label}
          value={percent ?? null}
          valueLabel={formatPercent(percent)}
          // The fixed width keeps all tracks the same length. The track is positioned, so it would
          // sit above the stretched link and swallow the click.
          className="pointer-events-none [&>span]:w-10 [&>span]:text-right"
          // An old report cannot raise an alarm: the cluster may be idle or gone by now.
          {...(lastKnown ? { normalMax: 100 } : {})}
        />
      </dd>
    </>
  );
}

/**
 * A silent cluster keeps its last report, so a zero or an unlabelled value would read as an idle
 * cluster. `clusterUsage` drops the zeros; what is left sits on the stale hatch and is announced as
 * last known.
 */
function ClusterCard({ cluster, href }: { cluster: Cluster; href: string }) {
  const { stale } = clusterPresentation(cluster);
  const { cpuPercent, memoryPercent, memoryAvailableBytes, activeNodes, lastKnown } =
    clusterUsage(cluster);
  const gpuCores = cluster.total_gpu_cores ?? 0;
  const capacity = [
    ...(activeNodes === undefined ? [] : [plural(activeNodes, 'active node')]),
    ...(gpuCores > 0 ? [plural(gpuCores, 'GPU core')] : []),
  ];
  const lastSeen = cluster.last_modified_timestamp;
  return (
    <Card className="hover:bg-accent/40 h-full gap-4 transition-colors">
      <div className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <Link to={href} className={`block truncate font-semibold ${stretchedLinkClassName}`}>
            {cluster.cluster_name}
          </Link>
          <div className="text-muted-foreground truncate text-sm tabular-nums">
            {capacity.join(', ') || 'No nodes reported'}
            {lastKnown && capacity.length > 0 ? ' (last known)' : ''}
          </div>
        </div>
        <ClusterStatusBadge cluster={cluster} />
      </div>
      {/* The percentage is mean usage over the workers, the bytes what is left: two facts. */}
      <dl
        className={cn(
          'mx-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-md px-2 py-1.5 text-xs',
          stale && [
            'text-muted-foreground [&_[data-slot=pointer-gauge]]:opacity-60',
            staleSurfaceClassName,
          ],
        )}
      >
        <Meter label="CPU" percent={cpuPercent} lastKnown={lastKnown} />
        <Meter label="Memory" percent={memoryPercent} lastKnown={lastKnown} />
        <dt className="text-muted-foreground">Available</dt>
        <dd className="tabular-nums">
          {memoryAvailableBytes ? (
            <LastKnown lastKnown={lastKnown}>{formatBytes(memoryAvailableBytes)}</LastKnown>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </dd>
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 px-5">
        <div className="flex flex-wrap gap-1">
          {cluster.virtualization.map((virtualization) => (
            <Badge key={virtualization} variant="secondary" className="font-mono">
              {virtualization}
            </Badge>
          ))}
        </div>
        <span className="text-muted-foreground ml-auto text-xs">
          {lastSeen ? `Last seen ${formatRelativeTime(lastSeen)}` : 'Never seen'}
        </span>
      </div>
    </Card>
  );
}

export function ClusterList({
  clusters,
  isLoading = false,
}: {
  clusters: readonly Cluster[];
  isLoading?: boolean;
}) {
  const addonPath = useAddonPath();
  const [search, setSearch] = useSearchParam('q');
  return (
    <DataList
      label="Clusters"
      noun="cluster"
      layout="grid"
      data={clusters}
      isLoading={isLoading}
      getRowId={(cluster) => cluster._id}
      searchValue={searchValue}
      sortOptions={SORT_OPTIONS}
      searchPlaceholder="Search clusters"
      globalFilter={search}
      onGlobalFilterChange={setSearch}
      renderItem={(cluster) => (
        <ClusterCard cluster={cluster} href={addonPath('clusters', cluster._id)} />
      )}
    />
  );
}
