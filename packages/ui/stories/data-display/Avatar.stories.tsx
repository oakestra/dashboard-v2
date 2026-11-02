import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '../../src';

const meta = {
  title: 'Data display/Avatar',
  component: Avatar,
  args: { size: 'default' },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] } },
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>AL</AvatarFallback>
    </Avatar>
  ),
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Fallback: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      {(['sm', 'default', 'lg'] as const).map((size) => (
        <Avatar key={size} size={size}>
          <AvatarFallback>AD</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
};

// An image that fails to load falls back to the initials, which is what this story shows when
// offline.
export const WithImage: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="https://github.com/oakestra.png" alt="Oakestra" />
      <AvatarFallback>OA</AvatarFallback>
    </Avatar>
  ),
};

export const WithBadge: Story = {
  args: { size: 'lg' },
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>BO</AvatarFallback>
      <AvatarBadge className="bg-success" />
    </Avatar>
  ),
};

export const Group: Story = {
  render: () => (
    <AvatarGroup>
      {['AD', 'AL', 'BO', 'CA'].map((initials) => (
        <Avatar key={initials}>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      ))}
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>
  ),
};
