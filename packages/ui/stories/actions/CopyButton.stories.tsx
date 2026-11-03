import type { Meta, StoryObj } from '@storybook/react-vite';

import { CopyButton, Toaster } from '../../src';

const meta = {
  title: 'Actions/CopyButton',
  component: CopyButton,
  args: { value: 'oakestra-cluster-1', label: 'Copy cluster id' },
  argTypes: {
    size: { control: 'inline-radio', options: ['icon', 'icon-sm', 'icon-xs', 'sm'] },
    variant: { control: 'inline-radio', options: ['ghost', 'outline', 'secondary'] },
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
} satisfies Meta<typeof CopyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IconOnly: Story = {};

export const WithText: Story = {
  args: { text: 'Copy', label: 'Copy logs', variant: 'outline' },
};
