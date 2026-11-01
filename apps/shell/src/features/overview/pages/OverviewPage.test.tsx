import type { Contributions } from '@oakestra/dashboard-sdk';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockStore } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { applicationsModule } from '../../applications';
import { overviewModule } from '../index';

describe('<OverviewPage>', () => {
  it("counts the user's applications, services, running instances and clusters", async () => {
    renderApp({
      modules: [overviewModule, applicationsModule],
      route: '/',
      user: { username: 'Admin' },
    });

    // Admin owns webshop (3 services, 4 running instances), iotpipe (2, 4) and mlbatch (1, 0).
    await waitFor(() => expect(screen.getByTestId('stat-applications')).toHaveTextContent('3'));
    await waitFor(() => expect(screen.getByTestId('stat-services')).toHaveTextContent('6'));
    await waitFor(() => expect(screen.getByTestId('stat-instances')).toHaveTextContent('8'));
    const activeClusters = mockStore.data.clusters.filter((c) => c.active).length;
    await waitFor(() =>
      expect(screen.getByTestId('stat-clusters')).toHaveTextContent(String(activeClusters)),
    );
    expect(screen.getByRole('heading', { name: 'Welcome, Admin' })).toBeVisible();
  });

  it('says so when no addon contributes a widget', async () => {
    renderApp({ modules: [overviewModule], route: '/' });

    expect(await screen.findByText('No widgets installed.')).toBeVisible();
  });

  it('links recent applications to their detail page', async () => {
    renderApp({
      modules: [overviewModule, applicationsModule],
      route: '/',
      user: { username: 'alice' },
    });

    const link = await screen.findByRole('link', { name: /analytics/ });
    const app = mockStore.data.applications.find((a) => a.userId === 'alice')!;
    expect(link).toHaveAttribute('href', `/applications/${app._id}`);
  });

  it('shows an empty state for users without applications', async () => {
    renderApp({ modules: [overviewModule], route: '/', user: { username: 'dave' } });
    expect(await screen.findByText('No applications yet')).toBeVisible();
    expect(screen.getByTestId('stat-applications')).toHaveTextContent('0');
  });

  it('renders widgets contributed to home.widgets', async () => {
    const contributions: Contributions = {
      'home.widgets': [
        { id: 'hello', title: 'Hello widget', component: () => <p>from an addon</p> },
      ],
    };
    renderApp({
      modules: [overviewModule, { id: 'ext', label: 'Ext', routes: [], contributions }],
      route: '/',
    });

    const widget = await screen.findByTestId('home-widget');
    expect(within(widget).getByText('Hello widget')).toBeVisible();
    expect(within(widget).getByText('from an addon')).toBeVisible();
  });
});
