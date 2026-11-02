import type { Meta, StoryObj } from '@storybook/react-vite';
import { MoreHorizontalIcon } from 'lucide-react';

import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  StatusBadge,
} from '../../src';

const meta = {
  title: 'Data display/Card',
  component: Card,
  parameters: {
    docs: {
      description: {
        component:
          'For titled page sections prefer `SectionCard`. With a plain Card, put actions in `CardAction` inside `CardHeader` (a grid, so `flex-row` on the header does nothing).',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-96 max-w-[calc(100vw-2rem)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>video-analytics</CardTitle>
        <CardDescription>Object detection on camera streams at the edge.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon-sm" aria-label="More actions">
            <MoreHorizontalIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <StatusBadge tone="success">3 running</StatusBadge>
        <StatusBadge tone="info" pulse>
          1 scheduled
        </StatusBadge>
      </CardContent>
      <CardFooter className="gap-2 border-t">
        <Button size="sm">Open</Button>
        <Button size="sm" variant="outline">
          Add service
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const ContentOnly: Story = {
  render: (args) => (
    <Card {...args}>
      <CardContent className="text-sm text-muted-foreground">
        A card with only content, for grouping a few lines of text.
      </CardContent>
    </Card>
  ),
};
