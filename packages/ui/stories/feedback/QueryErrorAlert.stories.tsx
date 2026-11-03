import type { Meta, StoryObj } from '@storybook/react-vite';

import { QueryErrorAlert } from '../../src';

const meta = {
  title: 'Feedback/QueryErrorAlert',
  component: QueryErrorAlert,
  args: {
    title: 'Could not load clusters',
    error: new Error('The backend did not answer in time.'),
    onRetry: () => {},
  },
  argTypes: { error: { control: false } },
  decorators: [
    (Story) => (
      <div className="w-[32rem] max-w-[calc(100vw-2rem)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QueryErrorAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithExtraText: Story = {
  args: { children: ' The data below may be out of date.' },
};

export const UnknownError: Story = { args: { error: 'not an Error object' } };
