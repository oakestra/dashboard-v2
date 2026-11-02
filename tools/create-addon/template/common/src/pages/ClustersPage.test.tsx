import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen } from '@testing-library/react';
import { ADDON_ID } from 'virtual:oakestra-addon';
import { describe, expect, it } from 'vitest';

import { ClustersPage } from './ClustersPage';

describe('ClustersPage', () => {
  it('lists the clusters of the API', async () => {
    renderInHost(<ClustersPage />, {
      addon: { addonId: ADDON_ID },
      // Endpoints that are not mocked throw, so a page cannot silently call more than expected.
      api: {
        clusters: {
          list: () => Promise.resolve([{ _id: 'c-1', cluster_name: 'berlin' }] as never),
        },
      },
    });
    expect(await screen.findByText('berlin')).toBeTruthy();
  });
});
