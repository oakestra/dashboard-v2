import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CircleCheckIcon,
  InfoIcon,
  OctagonXIcon,
  TerminalIcon,
  TriangleAlertIcon,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle, Button } from '../../src';

const meta = {
  title: 'Feedback/Alert',
  component: Alert,
  args: { variant: 'default' },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['default', 'info', 'success', 'warning', 'destructive'],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[32rem] max-w-[calc(100vw-2rem)]">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Alert {...args}>
      <TerminalIcon />
      <AlertTitle>CLI available</AlertTitle>
      <AlertDescription>
        Deploy the same SLA from your terminal with the Oakestra CLI.
      </AlertDescription>
    </Alert>
  ),
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="space-y-3">
      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>Scheduling</AlertTitle>
        <AlertDescription>The root scheduler is looking for a cluster.</AlertDescription>
      </Alert>
      <Alert variant="success">
        <CircleCheckIcon />
        <AlertTitle>Deployed</AlertTitle>
        <AlertDescription>All 3 services of the application are running.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>Partially active</AlertTitle>
        <AlertDescription>One of the addon containers restarted twice.</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <OctagonXIcon />
        <AlertTitle>Deployment failed</AlertTitle>
        <AlertDescription>No worker has enough memory for service "api".</AlertDescription>
      </Alert>
    </div>
  ),
};

export const WithAction: Story = {
  args: { variant: 'destructive' },
  render: (args) => (
    <Alert {...args}>
      <OctagonXIcon />
      <AlertTitle>Could not refresh the list</AlertTitle>
      <AlertDescription>
        <p>The addons manager did not answer. The table shows the last known state.</p>
        <Button size="sm" variant="outline" className="mt-1">
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  ),
};

export const WithoutIcon: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>Editing a deployed service is not supported yet.</AlertDescription>
    </Alert>
  ),
};
