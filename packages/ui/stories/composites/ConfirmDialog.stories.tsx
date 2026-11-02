import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { Button, ConfirmDialog, toast } from '../../src';

const meta = {
  title: 'Composites/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    open: false,
    onOpenChange: fn(),
    onConfirm: fn(),
    title: 'Undeploy service "api"?',
    description: 'All running instances are stopped. The service definition is kept.',
    confirmLabel: 'Undeploy',
    destructive: true,
  },
  argTypes: { open: { control: false } },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The caller owns `open` and closes the dialog once the mutation settles. Confirming here runs a
 * fake request for 1.5s, during which the dialog stays open and both buttons are disabled.
 */
export const Playground: Story = {
  render: function Render(args) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    return (
      <>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Undeploy
        </Button>
        <ConfirmDialog
          {...args}
          open={open}
          pending={pending}
          onOpenChange={(next) => {
            setOpen(next);
            args.onOpenChange(next);
          }}
          onConfirm={() => {
            args.onConfirm();
            setPending(true);
            setTimeout(() => {
              setPending(false);
              setOpen(false);
              toast.success('Service undeployed');
            }, 1500);
          }}
        />
      </>
    );
  },
};

// Open modals would cover the whole docs page, so these only show on their own canvas.
export const Open: Story = { tags: ['!autodocs'], args: { open: true } };

export const Pending: Story = { tags: ['!autodocs'], args: { open: true, pending: true } };

export const NonDestructive: Story = {
  tags: ['!autodocs'],
  args: {
    open: true,
    destructive: false,
    title: 'Restart all instances?',
    description: 'Instances restart one after another.',
    confirmLabel: 'Restart',
  },
};
