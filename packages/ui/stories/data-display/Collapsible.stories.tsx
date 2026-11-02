import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronsUpDownIcon } from 'lucide-react';

import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../src';

const meta = {
  title: 'Data display/Collapsible',
  component: Collapsible,
  args: { defaultOpen: false },
  render: (args) => (
    <Collapsible {...args} className="w-80 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-sm font-semibold">Environment variables (3)</h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Toggle environment variables">
            <ChevronsUpDownIcon />
          </Button>
        </CollapsibleTrigger>
      </div>
      {/* Names only: environment values may be secrets. */}
      <div className="rounded-md border px-3 py-2 font-mono text-sm">DATABASE_URL</div>
      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-3 py-2 font-mono text-sm">API_TOKEN</div>
        <div className="rounded-md border px-3 py-2 font-mono text-sm">LOG_LEVEL</div>
      </CollapsibleContent>
    </Collapsible>
  ),
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = { args: { defaultOpen: true } };
