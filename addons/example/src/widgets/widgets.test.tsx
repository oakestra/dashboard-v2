import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClusterWidget, HelloWidget } from './widgets';

describe('HelloWidget', () => {
  it('links to the addon root below its base path', () => {
    renderInHost(<HelloWidget />, { addon: { addonId: 'example' } });
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
