import type { Contributions } from '@oakestra/dashboard-sdk';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockStore } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { applicationsModule } from '../../applications';
import { overviewModule } from '../index';

function tile(label: string) {
  return within(screen.getByTestId('overview-summary'))
    .getByText(label, { selector: 'span' })
    .closest<HTMLElement>('[data-slot="stat-card"]')!;
}

describe('<OverviewPage>', () => {
  it("counts the user's applications, services, running instances and clusters", async () => {
    renderApp({
      modules: [overviewModule, applicationsModule],
      route: '/',
      user: { username: 'Admin' },
    });

    // Admin owns webshop (3 services, 4 running instances), iotpipe (2, 4) and mlbatch (1, 0).
    await waitFor(() => expect(tile('Applications')).toHaveTextContent('3'));
    await waitFor(() => expect(tile('Services')).toHaveTextContent('6'));
    await waitFor(() => expect(tile('Instances')).toHaveTextContent('8/8'));
    const activeClusters = mockStore.data.clusters.filter((c) => c.active).length;
    await waitFor(() =>
      expect(tile('Clusters')).toHaveTextContent(
        new RegExp(`${activeClusters}/${mockStore.data.clusters.length}\\s*active`),
      ),
    );
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeVisible();
    expect(screen.getByText('Welcome back, Admin.')).toBeVisible();
  });

  it('links the stat tiles to the pages behind them', async () => {
    renderApp({
      modules: [overviewModule, applicationsModule],
      route: '/',
      user: { username: 'Admin' },
    });

    await waitFor(() => expect(tile('Applications')).toHaveTextContent('3'));
    expect(tile('Applications')).toHaveAttribute('href', '/applications');
    expect(tile('Clusters')).toHaveAttribute('href', '/infrastructure');
  });

  it('does not link the clusters tile for users without infrastructure access', async () => {
    renderApp({ modules: [overviewModule], route: '/', user: { username: 'alice' } });

    await waitFor(() => expect(tile('Clusters')).toHaveTextContent('active'));
    expect(tile('Clusters')).not.toHaveAttribute('href');
  });

  it('lists services that cannot be scheduled under "Needs attention"', async () => {
    renderApp({
      modules: [overviewModule, applicationsModule],
      route: '/',
      user: { username: 'Admin' },
    });

    const card = await screen.findByTestId('needs-attention');
    const row = await within(card).findByRole('link', { name: /trainer/ });
    const service = mockStore.data.services.find((s) => s.microservice_name === 'trainer')!;
    expect(row).toHaveAttribute(
      'href',
      `/applications/${service.applicationID}/services/${service._id}`,
    );
    expect(within(row).getByTestId('status-badge')).toHaveTextContent('No capacity');
  });

  it('shows no widgets section when no addon contributes a widget', async () => {
    renderApp({ modules: [overviewModule], route: '/' });

    await screen.findByRole('heading', { name: 'Overview' });
    expect(screen.queryByText('No widgets installed.')).not.toBeInTheDocument();
    expect(screen.getByTestId('home-widgets')).toBeEmptyDOMElement();
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

  it('guides users without applications through their first deployment', async () => {
    const { user } = renderApp({
      modules: [overviewModule, applicationsModule],
      route: '/',
      user: { username: 'dave' },
    });

    const card = await screen.findByTestId('getting-started');
    expect(within(card).getByText('Deploy your first service')).toBeVisible();
    expect(tile('Applications')).toHaveTextContent('0');
    expect(screen.queryByTestId('needs-attention')).not.toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: /New application/ }));
    expect(await screen.findByRole('dialog', { name: 'New application' })).toBeVisible();
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
