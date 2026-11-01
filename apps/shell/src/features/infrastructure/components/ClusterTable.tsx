import type { Cluster } from '@oakestra/api';
import { Badge } from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { Link, useNavigate } from 'react-router';

import { formatPercent, formatRelativeTime } from '../../../lib/format';
import { describeMemory } from '../lib';
import { ClusterStatusBadge } from './ClusterStatusBadge';

const column = createDataTableColumnHelper<Cluster>();

const columns = column.columns([
  column.accessor('cluster_name', {
    header: 'Name',
    // A real link keeps the row reachable by keyboard; the row click is the mouse shortcut.
    cell: (info) => (
      <Link
        to={`/infrastructure/clusters/${info.row.original._id}`}
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
  }),
  column.accessor((cluster) => cluster.cpu_percent ?? cluster.aggregated_cpu_percent ?? 0, {
    id: 'cpu',
    header: 'CPU usage',
    cell: (info) => formatPercent(info.getValue()),
  }),
  column.accessor((cluster) => cluster.memory_percent ?? 0, {
    id: 'memory',
    header: 'Memory',
    cell: (info) => describeMemory(info.row.original),
  }),
  column.display({
    id: 'virtualization',
    header: 'Virtualization',
    cell: (info) => (
      <div className="flex flex-wrap gap-1">
        {info.row.original.virtualization.map((runtime) => (
          <Badge key={runtime} variant="secondary">
            {runtime}
          </Badge>
        ))}
      </div>
    ),
  }),
  column.accessor((cluster) => cluster.total_gpu_cores ?? 0, {
    id: 'gpu',
    header: 'GPU',
    cell: (info) => (info.getValue() > 0 ? `${info.getValue()} cores` : '-'),
  }),
  column.accessor((cluster) => cluster.last_modified_timestamp?.getTime() ?? 0, {
    id: 'last_seen',
    header: 'Last seen',
    cell: (info) => formatRelativeTime(info.row.original.last_modified_timestamp),
  }),
]);

export function ClusterTable({ clusters }: { clusters: readonly Cluster[] }) {
  const navigate = useNavigate();
  return (
    <DataTable
      label="Clusters"
      columns={columns}
      data={clusters}
      getRowId={(cluster) => cluster._id}
      searchPlaceholder="Search clusters"
      onRowClick={(cluster) => void navigate(`/infrastructure/clusters/${cluster._id}`)}
    />
  );
}
