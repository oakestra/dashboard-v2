import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
  type ChartConfig,
} from '../../src/chart';

const usage = Array.from({ length: 24 }, (_, hour) => ({
  time: `${String(hour).padStart(2, '0')}:00`,
  cpu: Math.round(35 + 25 * Math.sin(hour / 3.5) + (hour % 5) * 3),
  memory: Math.round(55 + 10 * Math.cos(hour / 5) + (hour % 3) * 2),
}));

const usageConfig = {
  cpu: { label: 'CPU', color: 'var(--chart-1)' },
  memory: { label: 'Memory', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const perCluster = [
  { cluster: 'edge-01', running: 12, failed: 1 },
  { cluster: 'edge-02', running: 8, failed: 0 },
  { cluster: 'edge-03', running: 15, failed: 3 },
  { cluster: 'edge-04', running: 5, failed: 0 },
];

const clusterConfig = {
  running: { label: 'Running', color: 'var(--chart-2)' },
  failed: { label: 'Failed', color: 'var(--chart-5)' },
} satisfies ChartConfig;

const meta = {
  title: 'Data display/Chart',
  component: ChartContainer,
  parameters: {
    docs: {
      description: {
        component:
          'Imported from the `@oakestra/ui/chart` subpath, which also re-exports the Recharts parts so features never import `recharts` directly. Series colors come from `ChartConfig` and the `--chart-1` to `--chart-5` tokens.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[40rem] max-w-[calc(100vw-2rem)]">
        <Story />
      </div>
    ),
  ],
  // Every story renders its own chart; these satisfy the required props for the docs table.
  args: { config: usageConfig, children: <></> },
  argTypes: { config: { control: false }, children: { control: false } },
} satisfies Meta<typeof ChartContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Area_: Story = {
  name: 'Area',
  render: () => (
    <ChartContainer config={usageConfig} className="h-64 w-full">
      <AreaChart data={usage} margin={{ left: 4, right: 8, top: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} width={36} unit="%" domain={[0, 100]} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="memory"
          type="monotone"
          stroke="var(--color-memory)"
          fill="var(--color-memory)"
          fillOpacity={0.15}
        />
        <Area
          dataKey="cpu"
          type="monotone"
          stroke="var(--color-cpu)"
          fill="var(--color-cpu)"
          fillOpacity={0.15}
        />
      </AreaChart>
    </ChartContainer>
  ),
};

export const Line_: Story = {
  name: 'Line with threshold',
  render: () => (
    <ChartContainer config={usageConfig} className="h-64 w-full">
      <LineChart data={usage} margin={{ left: 4, right: 8, top: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} width={36} unit="%" domain={[0, 100]} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ReferenceLine y={80} stroke="var(--destructive)" strokeDasharray="4 4" />
        <Line dataKey="cpu" type="monotone" stroke="var(--color-cpu)" dot={false} />
      </LineChart>
    </ChartContainer>
  ),
};

export const Bar_: Story = {
  name: 'Stacked bar',
  args: { config: clusterConfig },
  render: () => (
    <ChartContainer config={clusterConfig} className="h-64 w-full">
      <BarChart data={perCluster} margin={{ left: 4, right: 8, top: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="cluster" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="running" stackId="services" fill="var(--color-running)" />
        <Bar dataKey="failed" stackId="services" fill="var(--color-failed)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  ),
};

export const Palette: Story = {
  render: () => (
    <div className="flex gap-3">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="flex flex-col items-center gap-1.5">
          <div className="size-12 rounded-md" style={{ background: `var(--chart-${n})` }} />
          <code className="text-xs text-muted-foreground">--chart-{n}</code>
        </div>
      ))}
    </div>
  ),
};
