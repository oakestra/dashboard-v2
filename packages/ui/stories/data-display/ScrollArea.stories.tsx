import type { Meta, StoryObj } from '@storybook/react-vite';

import { ScrollArea, ScrollBar, Separator } from '../../src';

const LOG_LINES = Array.from(
  { length: 40 },
  (_, i) => `2026-11-01T12:${String(i).padStart(2, '0')}:00Z  INFO  heartbeat from worker-${i % 4}`,
);

const meta = {
  title: 'Data display/ScrollArea',
  component: ScrollArea,
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {
  render: (args) => (
    <ScrollArea {...args} className="h-64 w-[28rem] max-w-[calc(100vw-2rem)] rounded-md border">
      <div className="p-3 font-mono text-xs">
        {LOG_LINES.map((line, i) => (
          <div key={i}>
            {line}
            {i < LOG_LINES.length - 1 ? <Separator className="my-1.5" /> : null}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const Horizontal: Story = {
  render: (args) => (
    <ScrollArea {...args} className="w-80 rounded-md border whitespace-nowrap">
      <div className="flex gap-3 p-3">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="flex size-24 shrink-0 items-center justify-center rounded-md bg-muted text-sm"
          >
            node-{i + 1}
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
};
