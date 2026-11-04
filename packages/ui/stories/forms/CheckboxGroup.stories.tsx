import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ComponentProps } from 'react';

import { CheckboxGroup } from '../../src';

const meta = {
  title: 'Forms/CheckboxGroup',
  component: CheckboxGroup,
  args: {
    legend: 'Roles',
    value: ['editor'],
    onChange: () => {},
    options: [
      { value: 'viewer', label: 'Viewer', description: 'Reads everything.' },
      { value: 'editor', label: 'Editor', description: 'Changes what they own.' },
      { value: 'owner', label: 'Owner' },
    ],
  },
} satisfies Meta<typeof CheckboxGroup>;

function ControlledGroup(args: ComponentProps<typeof CheckboxGroup>) {
  const [value, setValue] = useState<string[]>([...args.value]);
  return <CheckboxGroup {...args} value={value} onChange={setValue} />;
}

export default meta;
type Story = StoryObj<typeof meta>;

export const Controlled: Story = {
  render: (args) => <ControlledGroup {...args} />,
};

export const Disabled: Story = { args: { disabled: true } };
