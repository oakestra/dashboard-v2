import type { Meta, StoryObj } from '@storybook/react-vite';

import { TimeSeriesChart } from '../../src/chart';

const start = Date.UTC(2026, 2, 1, 10, 0, 0);
const points = Array.from({ length: 36 }, (_, index) => ({
  timestamp: new Date(start + index * 5 * 60_000),
  value: 40 + 25 * Math.sin(index / 5) + (index % 4) * 2,
}));

const meta = {
  title: 'Data display/TimeSeriesChart',
  component: TimeSeriesChart,
  parameters: {
    docs: {
      description: {
        component:
          'A line or area chart of timestamped values, from the `@oakestra/ui/chart` subpath.',
      },
    },
  },
  args: { title: 'CPU usage', unit: 'percent', data: points },
  argTypes: {
    unit: { control: 'inline-radio', options: ['percent', 'bytes', 'number'] },
    variant: { control: 'inline-radio', options: ['area', 'line'] },
    data: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-[36rem] max-w-[calc(100vw-2rem)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimeSeriesChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Area: Story = { args: { variant: 'area' } };

export const Line: Story = { args: { variant: 'line', showTitle: true } };

export const Bytes: Story = {
  args: {
    title: 'Memory',
    unit: 'bytes',
    data: points.map((point) => ({ ...point, value: point.value * 1024 ** 3 })),
  },
};

export const NoData: Story = { args: { data: [] } };
