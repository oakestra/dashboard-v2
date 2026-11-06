import type { Meta, StoryObj } from '@storybook/react-vite';

import { PointerGauge } from '../../src';

const meta = {
  title: 'Data display/PointerGauge',
  component: PointerGauge,
  args: { value: 42, label: 'CPU', valueLabel: '42%' },
  argTypes: { value: { control: { type: 'range', min: 0, max: 120, step: 1 } } },
  decorators: [
    (Story) => (
      <div className="w-56">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PointerGauge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PastNormal: Story = { args: { value: 86, valueLabel: '86%' } };

export const OverMax: Story = { args: { value: 130, valueLabel: '130%' } };

export const NoData: Story = { args: { value: null } };

export const Small: Story = { args: { size: 'sm' } };
