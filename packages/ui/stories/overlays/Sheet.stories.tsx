import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  StatusBadge,
} from '../../src';

type Side = 'top' | 'right' | 'bottom' | 'left';

function AddonSheet({ side, defaultOpen }: { side: Side; defaultOpen?: boolean }) {
  return (
    <Sheet defaultOpen={defaultOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="capitalize">
          {side}
        </Button>
      </SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>analytics</SheetTitle>
          <SheetDescription>Installed from the marketplace, version 1.2.0.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 text-sm">
          <StatusBadge tone="warning">Partially active</StatusBadge>
          <p className="text-muted-foreground">
            1 of 2 containers is running. The monitor restarted the other one twice.
          </p>
        </div>
        <SheetFooter>
          <Button variant="destructive">Disable</Button>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const meta = {
  title: 'Overlays/Sheet',
  component: SheetContent,
  args: { side: 'right' },
  argTypes: { side: { control: 'inline-radio', options: ['top', 'right', 'bottom', 'left'] } },
  render: (args) => <AddonSheet side={args.side ?? 'right'} />,
} satisfies Meta<typeof SheetContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sides: Story = {
  render: () => (
    <div className="flex gap-2">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <AddonSheet key={side} side={side} />
      ))}
    </div>
  ),
};

// An open sheet would cover the whole docs page, so this one only shows on its own canvas.
export const Open: Story = {
  tags: ['!autodocs'],
  render: (args) => <AddonSheet side={args.side ?? 'right'} defaultOpen />,
};
