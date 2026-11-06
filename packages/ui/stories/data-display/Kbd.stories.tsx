import type { Meta, StoryObj } from '@storybook/react-vite';

import { Kbd } from '../../src';

const meta = {
  title: 'Data display/Kbd',
  component: Kbd,
  args: { children: '⌘K' },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Combination: Story = {
  render: () => (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      Press <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> to search
    </span>
  ),
};
