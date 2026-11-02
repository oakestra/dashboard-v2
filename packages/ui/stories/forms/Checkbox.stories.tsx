import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId } from 'react';

import { Checkbox, Label } from '../../src';

const meta = {
  title: 'Forms/Checkbox',
  component: Checkbox,
  // useId: a docs page renders every story at once, and fixed ids would clash.
  render: function Render(args) {
    const id = useId();
    return (
      <div className="flex items-center gap-2">
        <Checkbox {...args} id={id} />
        <Label htmlFor={id}>Restart on failure</Label>
      </div>
    );
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };

export const Indeterminate: Story = { args: { checked: 'indeterminate' } };

export const Invalid: Story = { args: { 'aria-invalid': true } };

export const Disabled: Story = { args: { disabled: true, defaultChecked: true } };
