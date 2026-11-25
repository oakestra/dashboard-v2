import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { cleanup, screen } from '@testing-library/react';
import { ADDON_ID } from 'virtual:oakestra-addon';
import { afterEach, describe, expect, it } from 'vitest';

import { EnergyWidget, FootprintWidget } from './Widgets';
import type { Cluster } from '../estimate';

const clusters = [
  {
    _id: 'c-1',
    cluster_name: 'berlin',
    cluster_location: '52.5,13.4,50',
    active: true,
    vcpus: 16,
    cpu_percent: 40,
    last_modified_timestamp: new Date(),
  },
  {
    _id: 'c-2',
    cluster_name: 'munich',
    cluster_location: '48.1,11.6,50',
    active: false,
    last_modified_timestamp: new Date(),
  },
] as unknown as Cluster[];

const api = { clusters: { list: () => Promise.resolve(clusters) } };

// No vitest globals, so Testing Library does not clean up on its own.
afterEach(cleanup);

describe('EnergyWidget', () => {
  it('shows power, intensity and CO2 of a reporting cluster', async () => {
    renderInHost(<EnergyWidget clusterId="c-1" />, { api, addon: { addonId: ADDON_ID } });
    expect(await screen.findByText('Power')).toBeTruthy();
    expect(screen.getByText('CO2 per day')).toBeTruthy();
    expect(screen.getByText(/kW$/)).toBeTruthy();
  });

  it('says why a silent cluster has no estimate', async () => {
    renderInHost(<EnergyWidget clusterId="c-2" />, { api, addon: { addonId: ADDON_ID } });
    expect(await screen.findByText(/stopped reporting/)).toBeTruthy();
  });
});

describe('FootprintWidget', () => {
  it('links into the addon', async () => {
    renderInHost(<FootprintWidget />, { api, addon: { addonId: ADDON_ID } });
    const link = await screen.findByRole('link', { name: 'Open Carbon & Energy' });
    expect(link.getAttribute('href')).toBe('/addons/carbon');
    expect(screen.getByText(/Greenest: berlin/)).toBeTruthy();
  });
});
