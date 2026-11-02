import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId } from 'react';

import {
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../../src';

const meta = {
  title: 'Forms/Select',
  component: Select,
  args: { defaultValue: 'edge-01' },
  // useId: a docs page renders every story at once, and fixed ids would clash.
  render: function Render(args) {
    const id = useId();
    return (
      <div className="grid gap-2">
        <Label htmlFor={id}>Target cluster</Label>
        <Select {...args}>
          <SelectTrigger id={id} className="w-56">
            <SelectValue placeholder="Pick a cluster" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Munich</SelectLabel>
              <SelectItem value="edge-01">edge-01</SelectItem>
              <SelectItem value="edge-02">edge-02</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Berlin</SelectLabel>
              <SelectItem value="edge-03">edge-03</SelectItem>
              <SelectItem value="edge-04" disabled>
                edge-04 (inactive)
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    );
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Placeholder: Story = { args: { defaultValue: undefined } };

export const Disabled: Story = { args: { disabled: true } };

export const Small: Story = {
  render: (args) => (
    <Select {...args} defaultValue="25">
      <SelectTrigger size="sm" aria-label="Rows per page">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {['10', '25', '50', '100'].map((size) => (
          <SelectItem key={size} value={size}>
            {size}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
};
