import type { Meta, StoryObj } from '@storybook/react-vite';
import { Loader2Icon, PlusIcon, RocketIcon, Trash2Icon } from 'lucide-react';

import { Button } from '../../src';

const meta = {
  title: 'Actions/Button',
  component: Button,
  args: { children: 'Deploy service' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'],
    },
    asChild: { control: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args}>Default</Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="outline">
        Outline
      </Button>
      <Button {...args} variant="ghost">
        Ghost
      </Button>
      <Button {...args} variant="link">
        Link
      </Button>
      <Button {...args} variant="destructive">
        Destructive
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="xs">
        Extra small
      </Button>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args}>Default</Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};

export const WithIcon: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args}>
        <RocketIcon />
        Deploy
      </Button>
      <Button {...args} variant="outline">
        <PlusIcon />
        New application
      </Button>
      <Button {...args} variant="destructive">
        <Trash2Icon />
        Undeploy
      </Button>
    </div>
  ),
};

export const IconOnly: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="icon-xs" variant="ghost" aria-label="Add">
        <PlusIcon />
      </Button>
      <Button {...args} size="icon-sm" variant="outline" aria-label="Add">
        <PlusIcon />
      </Button>
      <Button {...args} size="icon" aria-label="Add">
        <PlusIcon />
      </Button>
      <Button {...args} size="icon-lg" variant="secondary" aria-label="Add">
        <PlusIcon />
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { disabled: true },
  render: (args) => (
    <Button {...args}>
      <Loader2Icon className="animate-spin" />
      Deploying...
    </Button>
  ),
};

export const Disabled: Story = { args: { disabled: true } };

export const AsLink: Story = {
  render: (args) => (
    <Button {...args} asChild variant="outline">
      <a href="https://www.oakestra.io/docs/">Open the docs</a>
    </Button>
  ),
};
