import type { Meta, StoryObj } from '@storybook/react-vite';

import { Separator } from '../../src';

const meta = {
  title: 'Data display/Separator',
  component: Separator,
  argTypes: { orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] } },
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: (args) => (
    <div className="w-72">
      <p className="text-sm font-medium">edge-01</p>
      <p className="text-sm text-muted-foreground">Munich, 4 nodes</p>
      <Separator {...args} className="my-3" />
      <p className="text-sm font-medium">edge-02</p>
      <p className="text-sm text-muted-foreground">Berlin, 2 nodes</p>
    </div>
  ),
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  render: (args) => (
    <div className="flex h-5 items-center gap-3 text-sm">
      <span>Docs</span>
      <Separator {...args} />
      <span>GitHub</span>
      <Separator {...args} />
      <span>Discord</span>
    </div>
  ),
};
