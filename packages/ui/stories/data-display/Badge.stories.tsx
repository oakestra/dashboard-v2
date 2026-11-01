import type { Meta, StoryObj } from '@storybook/react-vite';
import { CpuIcon } from 'lucide-react';

import { Badge } from '../../src';

const VARIANTS = [
  'default',
  'secondary',
  'outline',
  'ghost',
  'link',
  'success',
  'warning',
  'info',
  'destructive',
  'neutral',
] as const;

const meta = {
  title: 'Data display/Badge',
  component: Badge,
  args: { children: 'amd64' },
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    asChild: { control: false },
  },
  parameters: {
    docs: {
      description: {
        component:
          'For status labels use `StatusBadge` instead, which maps meanings onto the soft `success`, `warning`, `info`, `destructive` and `neutral` variants.',
      },
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex max-w-md flex-wrap gap-2">
      {VARIANTS.map((variant) => (
        <Badge key={variant} {...args} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};

export const WithIcon: Story = {
  args: { variant: 'outline' },
  render: (args) => (
    <Badge {...args}>
      <CpuIcon />4 vCPU
    </Badge>
  ),
};
