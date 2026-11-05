import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlusIcon } from 'lucide-react';

import { Button, SectionCard, StatusBadge } from '../../src';

const services = [
  { name: 'frontend', image: 'ghcr.io/oakestra/demo-frontend:1.4', state: 'Running' },
  { name: 'api', image: 'ghcr.io/oakestra/demo-api:1.4', state: 'Running' },
  { name: 'worker', image: 'ghcr.io/oakestra/demo-worker:1.2', state: 'Scheduled' },
] as const;

const meta = {
  title: 'Composites/SectionCard',
  component: SectionCard,
  args: {
    title: 'Services',
    description: 'Microservices of this application.',
    children: (
      <p className="text-sm text-muted-foreground">
        Section content goes here: a form, a list, a chart.
      </p>
    ),
  },
  argTypes: {
    headingLevel: { control: 'inline-radio', options: [2, 3, 4] },
    action: { control: false },
    footer: { control: false },
    children: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-[36rem] max-w-[calc(100vw-2rem)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithAction: Story = {
  args: {
    action: (
      <Button size="sm" variant="outline">
        <PlusIcon />
        Add service
      </Button>
    ),
  },
};

export const WithFooter: Story = {
  args: {
    footer: (
      <>
        <Button size="sm">Save</Button>
        <Button size="sm" variant="ghost">
          Cancel
        </Button>
      </>
    ),
  },
};

export const FlushList: Story = {
  args: {
    flush: true,
    action: (
      <Button size="sm" variant="ghost">
        View all
      </Button>
    ),
    children: (
      // Rows carry the same horizontal padding as the header so they line up with the title.
      <ul className="divide-y border-t">
        {services.map((service) => (
          <li key={service.name} className="flex items-center justify-between gap-4 px-4 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{service.name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{service.image}</p>
            </div>
            <StatusBadge tone={service.state === 'Running' ? 'success' : 'info'}>
              {service.state}
            </StatusBadge>
          </li>
        ))}
      </ul>
    ),
  },
};
