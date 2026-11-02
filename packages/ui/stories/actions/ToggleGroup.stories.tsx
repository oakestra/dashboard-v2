import type { Meta, StoryObj } from '@storybook/react-vite';
import { LayoutGridIcon, ListIcon, MapIcon } from 'lucide-react';

import { ToggleGroup, ToggleGroupItem } from '../../src';

const meta = {
  title: 'Actions/ToggleGroup',
  component: ToggleGroup,
  args: { type: 'single', variant: 'outline', defaultValue: 'list' },
  argTypes: {
    type: { control: 'inline-radio', options: ['single', 'multiple'] },
    variant: { control: 'inline-radio', options: ['default', 'outline'] },
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
  },
  render: (args) => (
    <ToggleGroup {...args} aria-label="View">
      <ToggleGroupItem value="list" aria-label="List">
        <ListIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label="Grid">
        <LayoutGridIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="map" aria-label="Map">
        <MapIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Outline: Story = {};

export const Ghost: Story = { args: { variant: 'default' } };

export const WithLabels: Story = {
  render: (args) => (
    // Only variant and size: spreading all args would carry a `multiple` value into a single group.
    <ToggleGroup
      variant={args.variant}
      size={args.size}
      type="single"
      defaultValue="24h"
      aria-label="Time range"
    >
      <ToggleGroupItem value="1h" className="px-3">
        1h
      </ToggleGroupItem>
      <ToggleGroupItem value="24h" className="px-3">
        24h
      </ToggleGroupItem>
      <ToggleGroupItem value="7d" className="px-3">
        7d
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};
