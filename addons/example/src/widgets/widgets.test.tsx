import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen } from '@testing-library/react';
import { ADDON_ID } from 'virtual:oakestra-addon';
import { describe, expect, it } from 'vitest';

import { ClusterWidget, HelloWidget } from './widgets';

describe('HelloWidget', () => {
  it('links to the addon root below its base path', () => {
    // ADDON_ID comes from oakestraAddon() through vite.config.ts, which vitest.config.ts extends.
    renderInHost(<HelloWidget />, { addon: { addonId: ADDON_ID } });
    expect(screen.getByRole('link', { name: 'Open it' }).getAttribute('href')).toBe(
      '/addons/example',
    );
  });
});

describe('ClusterWidget', () => {
  it('shows the cluster it was given', () => {
    renderInHost(<ClusterWidget clusterId="c-1" />);
    expect(screen.getByText('Example widget for cluster c-1')).toBeTruthy();
  });
});
