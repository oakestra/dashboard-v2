import type { Meta, StoryObj } from '@storybook/react-vite';
import { BoldIcon, ItalicIcon, PinIcon } from 'lucide-react';

import { Toggle } from '../../src';

const meta = {
  title: 'Actions/Toggle',
  component: Toggle,
  args: { 'aria-label': 'Pin', children: <PinIcon /> },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'outline'] },
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
    children: { control: false },
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = { args: { variant: 'outline' } };

export const Pressed: Story = { args: { defaultPressed: true } };

export const WithText: Story = {
  args: { 'aria-label': undefined, variant: 'outline' },
  render: (args) => (
    <div className="flex gap-2">
      <Toggle {...args}>
        <BoldIcon />
        Bold
      </Toggle>
      <Toggle {...args} defaultPressed>
        <ItalicIcon />
        Italic
      </Toggle>
    </div>
  ),
};

export const Disabled: Story = { args: { disabled: true } };
