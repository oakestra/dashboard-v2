import type { Meta, StoryObj } from '@storybook/react-vite';

import { Progress } from '../../src';

const meta = {
  title: 'Data display/Progress',
  component: Progress,
  args: { value: 64, 'aria-label': 'Memory usage' },
  argTypes: { value: { control: { type: 'range', min: 0, max: 100, step: 1 } } },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { value: 0 } };

export const Full: Story = { args: { value: 100 } };

export const WithLabel: Story = {
  render: (args) => (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Memory</span>
        <span className="tabular-nums">{args.value}%</span>
      </div>
      <Progress {...args} />
    </div>
  ),
};
