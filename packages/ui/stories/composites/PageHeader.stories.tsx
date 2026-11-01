import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlusIcon, RefreshCwIcon } from 'lucide-react';

import { Button, PageHeader } from '../../src';

const meta = {
  title: 'Composites/PageHeader',
  component: PageHeader,
  args: {
    title: 'Applications',
    description: 'Every application you own, with the services deployed for it.',
  },
  argTypes: { actions: { control: false } },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithActions: Story = {
  args: {
    actions: (
      <>
        <Button variant="outline" size="sm">
          <RefreshCwIcon />
          Refresh
        </Button>
        <Button size="sm">
          <PlusIcon />
          New application
        </Button>
      </>
    ),
  },
};

export const TitleOnly: Story = { args: { description: undefined } };
