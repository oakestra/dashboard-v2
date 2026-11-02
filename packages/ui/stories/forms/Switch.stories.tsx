import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId } from 'react';

import { Label, Switch } from '../../src';

const meta = {
  title: 'Forms/Switch',
  component: Switch,
  // useId: a docs page renders every story at once, and fixed ids would clash.
  render: function Render(args) {
    const id = useId();
    return (
      <div className="flex items-center gap-2">
        <Switch {...args} id={id} />
        <Label htmlFor={id}>Auto-refresh</Label>
      </div>
    );
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };

export const Disabled: Story = { args: { disabled: true } };
