import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from '../../src';

const meta = {
  title: 'Forms/Input',
  component: Input,
  args: { placeholder: 'my-application', 'aria-label': 'Application name' },
  argTypes: {
    type: { control: 'select', options: ['text', 'email', 'password', 'number', 'search', 'file'] },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = { args: { defaultValue: 'video-analytics' } };

export const Password: Story = {
  args: { type: 'password', defaultValue: 'secret', 'aria-label': 'Password' },
};

export const Invalid: Story = { args: { 'aria-invalid': true, defaultValue: 'Not a valid name!' } };

export const Disabled: Story = { args: { disabled: true, defaultValue: 'root' } };

export const File: Story = { args: { type: 'file', 'aria-label': 'SLA file' } };
