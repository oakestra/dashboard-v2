import type { Meta, StoryObj } from '@storybook/react-vite';

import { JsonViewer } from '../../src';

const meta = {
  title: 'Data display/JsonViewer',
  component: JsonViewer,
  args: {
    title: 'Service definition',
    data: {
      microservice_name: 'nginx',
      virtualization: 'container',
      memory: 100,
      ports: [{ containerPort: 80 }],
    },
  },
  argTypes: { data: { control: 'object' } },
  decorators: [
    (Story) => (
      <div className="w-[32rem] max-w-[calc(100vw-2rem)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof JsonViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Collapsed: Story = { args: { defaultOpen: false } };

export const Downloadable: Story = { args: { downloadAs: 'service.json' } };
