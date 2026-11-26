import type { Cluster } from '@oakestra/api';
import { useAddonPath, useSearchParam } from '@oakestra/dashboard-sdk';
import {
  Badge,
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
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
    <div className="flex items-center gap-2">
      <dt className="text-muted-foreground w-12 shrink-0">{label}</dt>
      <dd className="w-32">
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
    </div>
  );
}

/**
 * One row per cluster. The graph above draws the same clusters; this list is for searching and
 * sorting them.
 *
 * A silent cluster keeps its last report, so a zero or an unlabelled value would read as an idle
 * cluster. `clusterUsage` drops the zeros; what is left sits on the stale hatch and is announced as
 * last known.
 */
function ClusterRow({ cluster, href }: { cluster: Cluster; href: string }) {
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
    <Item className="gap-x-6 gap-y-2 rounded-none px-4 py-3">
      <ItemContent className="min-w-48">
        <ItemTitle>
          <Link to={href} className={`truncate ${stretchedLinkClassName}`}>
            {cluster.cluster_name}
          </Link>
          <ClusterStatusBadge cluster={cluster} />
        </ItemTitle>
        <ItemDescription className="line-clamp-1 tabular-nums">
          {capacity.join(', ') || 'No nodes reported'}
          {lastKnown && capacity.length > 0 ? ' (last known)' : ''}
        </ItemDescription>
      </ItemContent>
      {/* The percentage is mean usage over the workers, the bytes what is left: two facts.
          Below `lg` the figures take a line of their own under the name. */}
      <dl
        className={cn(
          'flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-md px-2 py-1 text-xs max-lg:order-last max-lg:basis-full',
          stale && [
            'text-muted-foreground [&_[data-slot=pointer-gauge]]:opacity-60',
            staleSurfaceClassName,
          ],
        )}
      >
        <Meter label="CPU" percent={cpuPercent} lastKnown={lastKnown} />
        <Meter label="Memory" percent={memoryPercent} lastKnown={lastKnown} />
        <div className="flex w-36 items-center gap-2">
          <dt className="text-muted-foreground">Available</dt>
          <dd className="tabular-nums">
            {memoryAvailableBytes ? (
              <LastKnown lastKnown={lastKnown}>{formatBytes(memoryAvailableBytes)}</LastKnown>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </dd>
        </div>
      </dl>
      {/* On a phone this is a line of its own, runtimes left and the time right. */}
      <div className="flex flex-col items-end gap-1 max-sm:basis-full max-sm:flex-row max-sm:items-center max-sm:justify-between">
        <div className="flex flex-wrap gap-1 sm:justify-end">
          {cluster.virtualization.map((virtualization) => (
            <Badge key={virtualization} variant="secondary" className="font-mono">
              {virtualization}
            </Badge>
          ))}
        </div>
        <span className="text-muted-foreground text-xs">
          {lastSeen ? `Last seen ${formatRelativeTime(lastSeen)}` : 'Never seen'}
        </span>
      </div>
    </Item>
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
      data={clusters}
      isLoading={isLoading}
      getRowId={(cluster) => cluster._id}
      searchValue={searchValue}
      sortOptions={SORT_OPTIONS}
      searchPlaceholder="Search clusters"
      globalFilter={search}
      onGlobalFilterChange={setSearch}
      renderItem={(cluster) => (
        <ClusterRow cluster={cluster} href={addonPath('clusters', cluster._id)} />
      )}
    />
  );
}
