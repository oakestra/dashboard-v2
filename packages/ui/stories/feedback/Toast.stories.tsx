import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button, toast, Toaster } from '../../src';

const meta = {
  title: 'Feedback/Toast',
  component: Toaster,
  parameters: {
    docs: {
      description: {
        component:
          'Sonner. The shell mounts one `Toaster` at the app root and passes its theme in; call `toast()` from anywhere. Mutations do not toast themselves: failures go through the global MutationCache via `meta.errorMessage`.',
      },
    },
  },
  // The global decorator already mounts the Toaster.
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast('Service definition saved')}>
        Default
      </Button>
      <Button variant="outline" onClick={() => toast.success('Application created')}>
        Success
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.info('Installing addon', { description: 'This takes a few seconds.' })}
      >
        Info
      </Button>
      <Button variant="outline" onClick={() => toast.warning('Cluster edge-04 is inactive')}>
        Warning
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.error('Could not deploy service', {
            description: 'No worker has enough memory.',
          })
        }
      >
        Error
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.promise(new Promise((resolve) => setTimeout(resolve, 2000)), {
            loading: 'Undeploying...',
            success: 'Service undeployed',
            error: 'Undeploy failed',
          })
        }
      >
        Promise
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast('Service removed', { action: { label: 'Undo', onClick: () => toast('Restored') } })
        }
      >
        With action
      </Button>
    </div>
  ),
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {};
