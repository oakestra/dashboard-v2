import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppWindowIcon, BoxesIcon, ServerIcon, TriangleAlertIcon } from 'lucide-react';
import { fn } from 'storybook/test';

import { StatCard } from '../../src';

const meta = {
  title: 'Composites/StatCard',
  component: StatCard,
  args: {
    label: 'Active clusters',
    value: 3,
    icon: <ServerIcon />,
    hint: '12 worker nodes',
  },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['default', 'success', 'warning', 'info', 'destructive', 'neutral'],
    },
    icon: { control: false },
    children: { control: false },
    asChild: { control: false },
  },
  decorators: [
    // A lone card stretches to its container, so single-card stories get a card-sized frame.
    (Story, { parameters }) =>
      parameters.fullWidth ? (
        <Story />
      ) : (
        <div className="w-64">
          <Story />
        </div>
      ),
  ],
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Loading: Story = { args: { loading: true } };

export const AsButton: Story = { args: { onClick: fn() } };

export const AsLink: Story = { args: { href: '#clusters' } };

export const Grid: Story = {
  parameters: { layout: 'padded', fullWidth: true },
  render: () => (
    // Tiles fill their cell, so a row keeps one height even when only some have a hint.
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Applications" value={8} icon={<AppWindowIcon />} />
      <StatCard label="Services" value={21} icon={<BoxesIcon />} hint="17 running" />
      <StatCard label="Clusters" value={3} icon={<ServerIcon />} tone="success" hint="All active" />
      <StatCard
        label="Failed services"
        value={2}
        icon={<TriangleAlertIcon />}
        tone="destructive"
        hint="Needs attention"
      />
    </div>
  ),
};
