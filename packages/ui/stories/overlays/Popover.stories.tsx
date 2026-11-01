import type { Meta, StoryObj } from '@storybook/react-vite';
import { FilterIcon } from 'lucide-react';
import { useId } from 'react';

import { Button, Checkbox, Label, Popover, PopoverContent, PopoverTrigger } from '../../src';

const meta = {
  title: 'Overlays/Popover',
  component: Popover,
  render: function Render(args) {
    const id = useId();
    return (
      <Popover {...args}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <FilterIcon />
            Filter
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56">
          <p className="mb-3 text-sm font-medium">Show states</p>
          <div className="space-y-2">
            {['Running', 'Scheduled', 'Failed'].map((state) => (
              <div key={state} className="flex items-center gap-2">
                <Checkbox id={`${id}-${state}`} defaultChecked={state !== 'Failed'} />
                <Label htmlFor={`${id}-${state}`}>{state}</Label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Open: Story = { tags: ['!autodocs'], args: { defaultOpen: true } };
