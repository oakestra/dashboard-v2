import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlusIcon, ServerIcon } from 'lucide-react';
import { fn } from 'storybook/test';

import { Button, EmptyState, StatusBadge, type StatusTone } from '../../src';
import { createDataTableColumnHelper, DataTable } from '../../src/data-table';

interface Cluster {
  id: string;
  name: string;
  location: string;
  state: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  nodes: number;
  cpuPercent: number;
}

const STATE_TONE: Record<Cluster['state'], StatusTone> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  ERROR: 'destructive',
};

const LOCATIONS = ['Munich', 'Berlin', 'Zurich', 'Vienna', 'Paris', 'Milan', 'Lyon', 'Prague'];
const STATES: Cluster['state'][] = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'ERROR'];

const clusters: Cluster[] = Array.from({ length: 32 }, (_, i) => ({
  id: `cluster-${i + 1}`,
  name: `edge-${String(i + 1).padStart(2, '0')}`,
  location: LOCATIONS[i % LOCATIONS.length] ?? 'Munich',
  state: STATES[i % STATES.length] ?? 'ACTIVE',
  nodes: ((i * 7) % 12) + 1,
  cpuPercent: (i * 37) % 100,
}));

const column = createDataTableColumnHelper<Cluster>();
const columns = column.columns([
  column.accessor('name', {
    header: 'Name',
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  column.accessor('location', { header: 'Location' }),
  column.accessor('state', {
    header: 'State',
    cell: (info) => (
      <StatusBadge tone={STATE_TONE[info.getValue()]}>{info.getValue().toLowerCase()}</StatusBadge>
    ),
  }),
  column.accessor('nodes', { header: 'Nodes', meta: { numeric: true } }),
  column.accessor('cpuPercent', {
    header: 'CPU',
    cell: (info) => `${info.getValue()}%`,
    meta: { numeric: true },
  }),
]);

// DataTable is generic, so the stories take their args from this type instead of the component.
interface Args {
  onRowClick: (row: Cluster) => void;
}

const meta = {
  title: 'Composites/DataTable',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Imported from the `@oakestra/ui/data-table` subpath. Sorting, the search box and pagination are uncontrolled unless the value and its change handler are passed (for example to mirror them into URL search params).',
      },
    },
  },
  args: { onRowClick: fn() },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  render: (args) => (
    <DataTable
      label="Clusters"
      columns={columns}
      data={clusters}
      getRowId={(row) => row.id}
      onRowClick={args.onRowClick}
      searchPlaceholder="Search clusters"
    />
  ),
};

export const WithToolbar: Story = {
  render: (args) => (
    <DataTable
      label="Clusters"
      columns={columns}
      data={clusters}
      getRowId={(row) => row.id}
      onRowClick={args.onRowClick}
      initialSorting={[{ id: 'cpuPercent', desc: true }]}
      initialPageSize={5}
      toolbar={
        <Button size="sm">
          <PlusIcon />
          Attach cluster
        </Button>
      }
    />
  ),
};

export const Loading: Story = {
  render: () => <DataTable label="Clusters" columns={columns} data={undefined} isLoading />,
};

export const Empty: Story = {
  render: () => (
    <DataTable
      label="Clusters"
      columns={columns}
      data={[]}
      emptyState={
        <EmptyState
          icon={<ServerIcon />}
          title="No clusters attached"
          description="Attach a cluster orchestrator to start scheduling services."
        />
      }
    />
  ),
};
