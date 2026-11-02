import type { Meta, StoryObj } from '@storybook/react-vite';
import { InfoIcon, RefreshCwIcon } from 'lucide-react';

import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../../src';

const meta = {
  title: 'Overlays/Tooltip',
  component: TooltipContent,
  parameters: {
    docs: {
      description: {
        component:
          'Needs a `TooltipProvider` above it; the shell mounts one at the app root (here: the global decorator).',
      },
    },
  },
  args: { side: 'top' },
  argTypes: { side: { control: 'inline-radio', options: ['top', 'right', 'bottom', 'left'] } },
  render: (args) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Refresh">
          <RefreshCwIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent {...args}>Refresh now</TooltipContent>
    </Tooltip>
  ),
} satisfies Meta<typeof TooltipContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnText: Story = {
  render: (args) => (
    <p className="flex items-center gap-1.5 text-sm">
      Memory
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="About memory" className="text-muted-foreground">
            <InfoIcon className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent {...args} className="max-w-56">
          Resident memory of all instances, as reported by the worker.
        </TooltipContent>
      </Tooltip>
    </p>
  ),
};

export const Open: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <Tooltip defaultOpen>
      <TooltipTrigger asChild>
        <Button variant="outline">Hover target</Button>
      </TooltipTrigger>
      <TooltipContent {...args}>Always visible in this story</TooltipContent>
    </Tooltip>
  ),
};
