import { useAddonPath } from '@oakestra/dashboard-sdk';
import { formatPercent, formatRelativeTime } from '@oakestra/ui';
import type { Cluster } from '@oakestra/api';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';

import { describeMemory } from '../lib';
import { ClusterStatusBadge } from './ClusterStatusBadge';

const column = createDataTableColumnHelper<Cluster>();

/** An inactive cluster keeps its last report, so its usage would read as an idle cluster. */
const NO_DATA = <span className="text-muted-foreground">-</span>;

const createColumns = (addonPath: (...segments: string[]) => string) =>
  column.columns([
    column.accessor('cluster_name', {
      header: 'Name',
      // A real link keeps the row reachable by keyboard; the row click is the mouse shortcut.
      cell: (info) => (
        <Link
          to={addonPath('clusters', info.row.original._id)}
          className="font-medium hover:underline"
        >
          {info.getValue()}
        </Link>
      ),
    }),
    column.accessor('active', {
      header: 'Status',
      cell: (info) => <ClusterStatusBadge active={info.getValue()} />,
    }),
    column.accessor((cluster) => cluster.active_nodes ?? 0, {
      id: 'active_nodes',
      header: 'Active nodes',
      meta: { numeric: true },
    }),
    column.accessor((cluster) => cluster.cpu_percent ?? cluster.aggregated_cpu_percent ?? 0, {
      id: 'cpu',
      header: 'CPU usage',
      meta: { numeric: true },
      cell: (info) => (info.row.original.active ? formatPercent(info.getValue()) : NO_DATA),
    }),
    column.accessor((cluster) => cluster.memory_percent ?? 0, {
      id: 'memory',
      header: 'Memory',
      meta: { numeric: true },
      cell: (info) => (info.row.original.active ? describeMemory(info.row.original) : NO_DATA),
    }),
    column.display({
      id: 'virtualization',
      header: 'Virtualization',
      cell: (info) => (
        <span className="text-muted-foreground font-mono text-xs">
          {info.row.original.virtualization.join(', ') || '-'}
        </span>
      ),
    }),
    column.accessor((cluster) => cluster.total_gpu_cores ?? 0, {
      id: 'gpu',
      header: 'GPU',
      meta: { numeric: true },
      cell: (info) =>
        info.row.original.active && info.getValue() > 0 ? `${info.getValue()} cores` : NO_DATA,
    }),
    column.accessor((cluster) => cluster.last_modified_timestamp?.getTime() ?? 0, {
      id: 'last_seen',
      header: 'Last seen',
      cell: (info) => (
        <span className={info.row.original.active ? undefined : 'text-warning'}>
          {formatRelativeTime(info.row.original.last_modified_timestamp)}
        </span>
      ),
    }),
  ]);

export function ClusterTable({ clusters }: { clusters: readonly Cluster[] }) {
  const navigate = useNavigate();
  const addonPath = useAddonPath();
  const columns = useMemo(() => createColumns(addonPath), [addonPath]);
  return (
    <DataTable
      label="Clusters"
      columns={columns}
      data={clusters}
      getRowId={(cluster) => cluster._id}
      searchPlaceholder="Search clusters"
      onRowClick={(cluster) => void navigate(addonPath('clusters', cluster._id))}
    />
  );
}
