import type { Meta, StoryObj } from '@storybook/react-vite';

import { Slider } from '../../src';

const meta = {
  title: 'Forms/Slider',
  component: Slider,
  args: { defaultValue: [40], thumbLabel: 'Replicas' },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Range: Story = {
  args: { defaultValue: [20, 70], thumbLabel: ['Minimum', 'Maximum'] },
};

export const Disabled: Story = { args: { disabled: true } };
