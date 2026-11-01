import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId } from 'react';

import { Label, RadioGroup, RadioGroupItem } from '../../src';

const OPTIONS = [
  { value: 'container', label: 'Container' },
  { value: 'unikernel', label: 'Unikernel' },
  { value: 'wasm', label: 'WebAssembly' },
] as const;

const meta = {
  title: 'Forms/RadioGroup',
  component: RadioGroup,
  args: { defaultValue: 'container', 'aria-label': 'Virtualization' },
  argTypes: { orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] } },
  // useId: a docs page renders every story at once, and fixed ids would clash.
  render: function Render(args) {
    const id = useId();
    return (
      <RadioGroup
        {...args}
        className={args.orientation === 'horizontal' ? 'flex gap-6' : undefined}
      >
        {OPTIONS.map((option) => (
          <div key={option.value} className="flex items-center gap-2">
            <RadioGroupItem value={option.value} id={`${id}-${option.value}`} />
            <Label htmlFor={`${id}-${option.value}`}>{option.label}</Label>
          </div>
        ))}
      </RadioGroup>
    );
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {};

export const Horizontal: Story = { args: { orientation: 'horizontal' } };

export const Disabled: Story = { args: { disabled: true } };
