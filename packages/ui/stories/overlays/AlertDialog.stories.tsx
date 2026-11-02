import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from '../../src';

const meta = {
  title: 'Overlays/AlertDialog',
  component: AlertDialog,
  parameters: {
    docs: {
      description: {
        component:
          'The primitive behind `ConfirmDialog`. `AlertDialogAction` closes the dialog on click; for actions that run a request, use `ConfirmDialog` so the dialog stays open until the request settles.',
      },
    },
  },
  render: (args) => (
    <AlertDialog {...args}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Log out</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Log out of all tabs?</AlertDialogTitle>
          <AlertDialogDescription>
            Logging out here ends the session in every open dashboard tab.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Log out</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
} satisfies Meta<typeof AlertDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// An open modal would cover the whole docs page, so this one only shows on its own canvas.
export const Open: Story = { tags: ['!autodocs'], args: { defaultOpen: true } };
