import type { Meta, StoryObj } from '@storybook/react-vite';
import { Loader2Icon } from 'lucide-react';

import { StatusBadge, StatusDot, type StatusTone } from '../../src';

const TONES: readonly { tone: StatusTone; label: string; meaning: string }[] = [
  { tone: 'success', label: 'Running', meaning: 'Healthy, nothing to do' },
  { tone: 'warning', label: 'Partially active', meaning: 'Degraded or needs attention soon' },
  { tone: 'info', label: 'Scheduled', meaning: 'In progress or waiting on the system' },
  { tone: 'destructive', label: 'Failed', meaning: 'Broken, someone has to act' },
  { tone: 'neutral', label: 'Stopped', meaning: 'Inactive, disabled or unknown' },
];

const meta = {
  title: 'Composites/StatusBadge',
  component: StatusBadge,
  args: { tone: 'success', children: 'Running' },
  argTypes: {
    tone: { control: 'inline-radio', options: TONES.map((t) => t.tone) },
    icon: { control: false },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Tones are meanings, not backend states. Each feature maps its own states onto a tone in one place, so the same meaning gets the same color on every page.',
      },
    },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: () => (
    <table className="text-sm">
      <tbody>
        {TONES.map(({ tone, label, meaning }) => (
          <tr key={tone}>
            <td className="py-1.5 pr-6 font-mono text-xs text-muted-foreground">{tone}</td>
            <td className="py-1.5 pr-6">
              <StatusBadge tone={tone}>{label}</StatusBadge>
            </td>
            <td className="py-1.5 text-muted-foreground">{meaning}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

export const Pulsing: Story = {
  args: { tone: 'info', pulse: true, children: 'Requested' },
};

export const WithSpinner: Story = {
  args: {
    tone: 'info',
    icon: <Loader2Icon className="animate-spin" />,
    children: 'Installing',
  },
};

export const WithoutDot: Story = { args: { tone: 'neutral', dot: false, children: 'Disabled' } };

export const Dot: Story = {
  name: 'StatusDot',
  render: () => (
    <ul className="space-y-2 text-sm">
      {TONES.map(({ tone, label }) => (
        <li key={tone} className="flex items-center gap-2">
          <StatusDot tone={tone} pulse={tone === 'info'} />
          {label}
        </li>
      ))}
    </ul>
  ),
};
