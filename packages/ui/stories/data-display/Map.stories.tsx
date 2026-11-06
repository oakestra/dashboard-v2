import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusDot } from '../../src';
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  MarkerTooltip,
} from '../../src/map';

const clusters = [
  { name: 'edge-munich', lng: 11.576, lat: 48.137, nodes: 4, active: true },
  { name: 'edge-berlin', lng: 13.405, lat: 52.52, nodes: 2, active: true },
  { name: 'edge-zurich', lng: 8.541, lat: 47.376, nodes: 3, active: true },
  { name: 'edge-vienna', lng: 16.373, lat: 48.208, nodes: 1, active: false },
];

const meta = {
  title: 'Data display/Map',
  component: Map,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'mapcn on MapLibre GL, imported from the `@oakestra/ui/map` subpath. Needs WebGL2 and loads CARTO basemap tiles from the internet; the basemap follows the `.dark` class (toolbar theme switch). The host registers the worker URL once with `setMapWorkerUrl()`, as `.storybook/preview.tsx` does.',
      },
    },
  },
  args: { center: [12, 49.5], zoom: 4.3 },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div className="h-96 w-full overflow-hidden rounded-xl border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Map>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basemap: Story = {
  render: (args) => (
    <Map {...args}>
      <MapControls showZoom showCompass />
    </Map>
  ),
};

export const ClusterLocations: Story = {
  render: (args) => (
    <Map {...args}>
      {clusters.map((cluster) => (
        <MapMarker key={cluster.name} longitude={cluster.lng} latitude={cluster.lat}>
          <MarkerContent>
            <div
              className={
                cluster.active
                  ? 'size-4 rounded-full border-2 border-white bg-primary shadow-md'
                  : 'size-4 rounded-full border-2 border-white bg-muted-foreground shadow-md'
              }
            />
            <MarkerLabel position="bottom">{cluster.name}</MarkerLabel>
          </MarkerContent>
          <MarkerTooltip>
            <div className="flex items-center gap-2 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
              <StatusDot tone={cluster.active ? 'success' : 'neutral'} />
              {cluster.nodes} {cluster.nodes === 1 ? 'node' : 'nodes'}
            </div>
          </MarkerTooltip>
        </MapMarker>
      ))}
      <MapControls />
    </Map>
  ),
};

export const Loading: Story = {
  args: { loading: true },
  render: (args) => <Map {...args} />,
};
