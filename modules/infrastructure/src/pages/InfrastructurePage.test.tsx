import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InfrastructurePage } from './InfrastructurePage';

const api = { clusters: { list: () => Promise.resolve([]) } };
const addon = { addonId: 'infrastructure', basePath: '/infrastructure' };

describe('<InfrastructurePage>', () => {
  it('links to the Grafana of the deployment', async () => {
    renderInHost(<InfrastructurePage />, {
      api,
      addon,
      links: { grafanaUrl: 'https://grafana.example/d/oakestra' },
    });

    const link = await screen.findByRole('link', { name: 'Open Grafana' });
    expect(link).toHaveAttribute('href', 'https://grafana.example/d/oakestra');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('has no Grafana button when the deployment has none', async () => {
    renderInHost(<InfrastructurePage />, { api, addon });

    expect(await screen.findByRole('heading', { name: 'Infrastructure' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Open Grafana' })).not.toBeInTheDocument();
  });
});
