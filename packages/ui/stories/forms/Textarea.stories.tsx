import type { Meta, StoryObj } from '@storybook/react-vite';

import { Textarea } from '../../src';

const meta = {
  title: 'Forms/Textarea',
  component: Textarea,
  args: {
    placeholder: 'Describe what this application does',
    'aria-label': 'Description',
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Code: Story = {
  args: {
    className: 'font-mono text-xs',
    rows: 8,
    defaultValue: JSON.stringify(
      { sla_version: 'v2.0', customerID: 'Admin', applications: [] },
      null,
      2,
    ),
  },
};

export const Invalid: Story = { args: { 'aria-invalid': true, defaultValue: '{ "broken": ' } };

export const Disabled: Story = { args: { disabled: true } };
