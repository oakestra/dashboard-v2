import type { Meta, StoryObj } from '@storybook/react-vite';

import { SourceTag, Tabs, TabsList, TabsTrigger } from '../../src';

const meta = {
  title: 'Data display/SourceTag',
  component: SourceTag,
  args: { name: 'analytics', version: '1.2.0' },
} satisfies Meta<typeof SourceTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NameOnly: Story = { args: { version: undefined } };

export const InsideTab: Story = {
  render: () => (
    <Tabs defaultValue="a">
      <TabsList>
        <TabsTrigger value="a">Overview</TabsTrigger>
        <TabsTrigger value="b">
          Traffic <SourceTag name="analytics" />
        </TabsTrigger>
      </TabsList>
    </Tabs>
  ),
};
