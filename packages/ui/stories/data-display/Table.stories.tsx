import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  StatusBadge,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  type StatusTone,
} from '../../src';

const instances: { id: number; cluster: string; state: string; tone: StatusTone; cpu: number }[] = [
  { id: 0, cluster: 'edge-01', state: 'Running', tone: 'success', cpu: 12.4 },
  { id: 1, cluster: 'edge-02', state: 'Running', tone: 'success', cpu: 48.1 },
  { id: 2, cluster: 'edge-03', state: 'Failed', tone: 'destructive', cpu: 0 },
];

const meta = {
  title: 'Data display/Table',
  component: Table,
  parameters: {
    docs: {
      description: {
        component:
          'The bare table markup. For sorting, search and pagination use `DataTable` from `@oakestra/ui/data-table`.',
      },
    },
  },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Table {...args} className="w-[32rem]">
      <TableCaption>Instances of service "api"</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Instance</TableHead>
          <TableHead>Cluster</TableHead>
          <TableHead>State</TableHead>
          <TableHead className="text-right">CPU</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {instances.map((instance) => (
          <TableRow key={instance.id}>
            <TableCell className="font-mono">#{instance.id}</TableCell>
            <TableCell>{instance.cluster}</TableCell>
            <TableCell>
              <StatusBadge tone={instance.tone}>{instance.state}</StatusBadge>
            </TableCell>
            <TableCell className="text-right tabular-nums">{instance.cpu.toFixed(1)}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className="text-right tabular-nums">60.5%</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};
