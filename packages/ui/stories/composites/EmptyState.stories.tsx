import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppWindowIcon, PlusIcon, SearchXIcon } from 'lucide-react';

import { Button, EmptyState } from '../../src';

const meta = {
  title: 'Composites/EmptyState',
  component: EmptyState,
  args: {
    icon: <AppWindowIcon />,
    title: 'No applications yet',
    description: 'Applications group the services you deploy. Create one to get started.',
    action: (
      <Button size="sm">
        <PlusIcon />
        New application
      </Button>
    ),
  },
  argTypes: {
    icon: { control: false },
    action: { control: false },
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const NoResults: Story = {
  args: {
    icon: <SearchXIcon />,
    title: 'No matches',
    description: 'Nothing matches "edge-cluster". Try a different search.',
    action: undefined,
  },
};

export const TitleOnly: Story = {
  args: { icon: undefined, description: undefined, action: undefined, title: 'Nothing here yet' },
};
