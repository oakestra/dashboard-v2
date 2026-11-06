import type { Meta, StoryObj } from '@storybook/react-vite';

import { DropdownMenuItem, RowMenu } from '../../src';

const meta = {
  title: 'Composites/RowMenu',
  component: RowMenu,
  args: {
    label: 'Actions for shop',
    children: (
      <>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </>
    ),
  },
} satisfies Meta<typeof RowMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PageHeaderSize: Story = { args: { size: 'icon', label: 'More actions' } };
