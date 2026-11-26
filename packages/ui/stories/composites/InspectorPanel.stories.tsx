import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import {
  Button,
  Fact,
  FactList,
  InspectorPanel,
  InspectorSection,
  PointerGauge,
  StatusBadge,
  StatusDot,
} from '../../src';

const workers = [
  { id: 'a1f3c9', services: 'api, frontend', tone: 'success' },
  { id: '7be210', services: 'cache', tone: 'warning' },
] as const;

const meta = {
  title: 'Composites/InspectorPanel',
  component: InspectorPanel,
  args: {
    kind: 'Cluster',
    title: 'edge-munich',
    onClose: fn(),
    status: <StatusBadge tone="success">Reporting</StatusBadge>,
    children: (
      <>
        <FactList>
          <Fact label="Location">48.14° N, 11.58° E</Fact>
          <Fact label="Workers">2</Fact>
          <Fact label="CPU">
            <PointerGauge size="sm" label="CPU" value={42} valueLabel="42%" />
          </Fact>
          {/* No value, so the row is left out. */}
          <Fact label="CSI drivers">{undefined}</Fact>
        </FactList>
        <InspectorSection title="Workers seen here">
          <ul className="divide-y rounded-lg border">
            {workers.map((worker) => (
              <li key={worker.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                <StatusDot tone={worker.tone} />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{worker.id}</span>
                <span className="text-xs text-muted-foreground">{worker.services}</span>
              </li>
            ))}
          </ul>
        </InspectorSection>
      </>
    ),
  },
  argTypes: {
    headingLevel: { control: 'inline-radio', options: [2, 3, 4] },
    status: { control: false },
    footer: { control: false },
    children: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-[22rem] max-w-[calc(100vw-2rem)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InspectorPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithFooter: Story = {
  args: {
    footer: <Button>Open cluster</Button>,
  },
};

/** A capped height, as in FlowGraph's floating panel: the body scrolls, header and footer stay. */
export const CappedHeight: Story = {
  args: {
    footer: <Button>Open cluster</Button>,
  },
  decorators: [
    (Story) => (
      <div className="flex h-72 flex-col">
        <Story />
      </div>
    ),
  ],
};
