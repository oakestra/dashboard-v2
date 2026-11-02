import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId } from 'react';

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  Textarea,
} from '../../src';

const meta = {
  title: 'Overlays/Dialog',
  component: Dialog,
  render: function Render(args) {
    const id = useId();
    return (
      <Dialog {...args}>
        <DialogTrigger asChild>
          <Button>New application</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New application</DialogTitle>
            <DialogDescription>
              Services are added to the application after it was created.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
              <Input id={`${id}-name`} placeholder="video-analytics" />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
              <Textarea id={`${id}-description`} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// An open modal would cover the whole docs page, so this one only shows on its own canvas.
export const Open: Story = { tags: ['!autodocs'], args: { defaultOpen: true } };
