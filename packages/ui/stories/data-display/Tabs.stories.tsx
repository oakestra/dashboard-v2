import type { Meta, StoryObj } from '@storybook/react-vite';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../src';

const meta = {
  title: 'Data display/Tabs',
  component: Tabs,
  args: { defaultValue: 'overview' },
  render: (args) => (
    <Tabs {...args} className="w-96 max-w-[calc(100vw-2rem)]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="instances">Instances</TabsTrigger>
        <TabsTrigger value="sla">SLA</TabsTrigger>
        <TabsTrigger value="logs" disabled>
          Logs
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-sm text-muted-foreground">
        Image, resources and the current state of the service.
      </TabsContent>
      <TabsContent value="instances" className="text-sm text-muted-foreground">
        One row per running instance, with its cluster and metrics.
      </TabsContent>
      <TabsContent value="sla" className="text-sm text-muted-foreground">
        The service part of the deployment descriptor.
      </TabsContent>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SecondTab: Story = { args: { defaultValue: 'instances' } };
