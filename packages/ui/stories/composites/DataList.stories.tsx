import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Button,
  Card,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
  StatusBadge,
  type StatusTone,
} from '../../src';
import { DataList, type DataListSortOption } from '../../src/data-table';

interface Cluster {
  id: string;
  name: string;
  location: string;
  tone: StatusTone;
  state: string;
  nodes: number;
}

const STATES: readonly [StatusTone, string][] = [
  ['success', 'Active'],
  ['success', 'Active'],
  ['warning', 'Degraded'],
  ['destructive', 'Failed'],
];
const LOCATIONS = ['Munich', 'Vienna', 'Hamburg', 'Leipzig', 'Zurich'];

const clusters: Cluster[] = Array.from({ length: 30 }, (_, i) => {
  const [tone, state] = STATES[i % STATES.length]!;
  return {
    id: `cluster-${i + 1}`,
    name: `edge-${String(i + 1).padStart(2, '0')}`,
    location: LOCATIONS[i % LOCATIONS.length]!,
    tone,
    state,
    nodes: ((i * 7) % 12) + 1,
  };
});

const searchValue = (cluster: Cluster) => `${cluster.name} ${cluster.location}`;
const sortOptions: readonly DataListSortOption<Cluster>[] = [
  { id: 'name', label: 'Name', value: (cluster) => cluster.name },
  { id: 'nodes', label: 'Most nodes', value: (cluster) => cluster.nodes, desc: true },
];

const meta = {
  title: 'Composites/DataList',
  component: DataList<Cluster>,
  args: {
    label: 'Clusters',
    noun: 'cluster',
    data: clusters,
    getRowId: (cluster) => cluster.id,
    searchValue,
    sortOptions,
    searchPlaceholder: 'Search clusters',
    renderItem: (cluster) => (
      <Item>
        <ItemContent>
          <ItemTitle>{cluster.name}</ItemTitle>
          <ItemDescription>{cluster.location}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <StatusBadge tone={cluster.tone}>{cluster.state}</StatusBadge>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </ItemActions>
      </Item>
    ),
  },
} satisfies Meta<typeof DataList<Cluster>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {};

export const Grid: Story = {
  args: {
    layout: 'grid',
    renderItem: (cluster) => (
      <Card className="h-full gap-1 px-5">
        <div className="font-semibold">{cluster.name}</div>
        <div className="text-muted-foreground text-sm">{cluster.location}</div>
        <StatusBadge tone={cluster.tone} className="mt-2">
          {cluster.state}
        </StatusBadge>
      </Card>
    ),
  },
};

export const Loading: Story = { args: { data: undefined, isLoading: true } };

export const Empty: Story = { args: { data: [] } };
