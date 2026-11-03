import type { Meta, StoryObj } from '@storybook/react-vite';

import { LocationMap } from '../../src/location-map';

const meta = {
  title: 'Data display/LocationMap',
  component: LocationMap,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Markers and optional radius circles that fit themselves into view, from the `@oakestra/ui/location-map` subpath (the map itself loads lazily). Needs WebGL2. Build entries from a cluster with `toMapLocation(name, parseClusterLocation(cluster.cluster_location))` (the parser is in `@oakestra/api`).',
      },
    },
  },
  args: {
    ariaLabel: 'Cluster locations',
    locations: [
      { lat: 48.137, lng: 11.576, radiusKm: 80, label: 'edge-munich' },
      { lat: 52.52, lng: 13.405, label: 'edge-berlin', href: '#berlin' },
      { lat: 47.376, lng: 8.541, label: 'edge-zurich (inactive)', tone: 'warning' },
    ],
  },
  argTypes: { locations: { control: 'object' }, renderLink: { control: false } },
} satisfies Meta<typeof LocationMap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const SinglePoint: Story = {
  args: { locations: [{ lat: 48.137, lng: 11.576, label: 'edge-munich' }] },
};

export const Empty: Story = { args: { locations: [] } };
