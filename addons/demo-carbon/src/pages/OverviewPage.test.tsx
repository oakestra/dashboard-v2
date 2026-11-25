import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { cleanup, screen } from '@testing-library/react';
import { ADDON_ID } from 'virtual:oakestra-addon';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { OverviewPage } from './OverviewPage';
import type { Cluster } from '../estimate';

// No vitest globals, so Testing Library does not clean up on its own.
afterEach(cleanup);

beforeAll(() => {
  // Recharts measures its container; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

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
  { _id: 'c-2', cluster_name: 'munich', active: false, last_modified_timestamp: new Date() },
] as unknown as Cluster[];

describe('OverviewPage', () => {
  it('lists clusters and links to the shell cluster page', async () => {
    renderInHost(<OverviewPage />, {
      addon: { addonId: ADDON_ID },
      api: { clusters: { list: () => Promise.resolve(clusters) } },
    });
    const link = await screen.findByRole('link', { name: 'berlin' });
    expect(link.getAttribute('href')).toBe('/infrastructure/clusters/c-1');
    expect(screen.getByText('Total power')).toBeTruthy();
    expect(screen.getByText('Not reporting')).toBeTruthy();
  });

  it('does not link when infrastructure is disabled', async () => {
    renderInHost(<OverviewPage />, {
      addon: { addonId: ADDON_ID },
      features: [],
      api: { clusters: { list: () => Promise.resolve(clusters) } },
    });
    expect((await screen.findAllByText('berlin')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'berlin' })).toBeNull();
  });
});
