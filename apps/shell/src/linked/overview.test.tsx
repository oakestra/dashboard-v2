import type { Contributions } from '@oakestra/dashboard-sdk';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { coreModules, linkedAddons } from '../app/modules';
import type { PresetInput } from '../core/config/preset';
import { mockStore } from '../test/msw';
import { renderApp } from '../test/render';

// The overview's tiles and sections are `home.widgets` of the applications and infrastructure
// packages; this checks them on the real page, laid out by the shell. The page's own layout rules
// are tested next to it in features/overview.
const overviewModule = coreModules.find((module) => module.id === 'overview')!;

function renderOverview(
  options: { username?: string; preset?: PresetInput; contributions?: Contributions } = {},
) {
  const extra = options.contributions
    ? [{ id: 'ext', label: 'Ext', routes: [], contributions: options.contributions }]
    : [];
  return renderApp({
    modules: [overviewModule, ...extra],
    linked: linkedAddons,
    route: '/',
    user: { username: options.username ?? 'Admin' },
    ...(options.preset ? { preset: options.preset } : {}),
  });
}

function summary() {
  return within(screen.getByTestId('overview-summary'));
}

function tile(label: string) {
  return summary()
    .getByText(label, { selector: 'span' })
    .closest<HTMLElement>('[data-slot="stat-card"]')!;
}

describe('overview widgets of the linked packages', () => {
  it("counts the user's applications, services, running instances and clusters", async () => {
    renderOverview();

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
    expect(screen.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
  });

  it('puts the tiles in the summary row in their order, and the sections below it', async () => {
    renderOverview();

    await waitFor(() => expect(tile('Clusters')).toBeInTheDocument());
    const ids = (testId: string) =>
      Array.from(
        screen.getByTestId(testId).querySelectorAll('[data-testid="home-widget"]'),
        (element) => element.getAttribute('data-widget-id'),
      );
    expect(ids('overview-summary')).toEqual([
      'applications:applications',
      'applications:services',
      'applications:instances',
      'infrastructure:clusters',
    ]);
    expect(ids('home-sections')).toEqual([
      'applications:needs-attention',
      'applications:recent-applications',
    ]);
    expect(screen.getByTestId('home-widgets')).toBeEmptyDOMElement();
  });

  it('links the stat tiles to the pages behind them', async () => {
    renderOverview();

    await waitFor(() => expect(tile('Applications')).toHaveTextContent('3'));
    expect(tile('Applications')).toHaveAttribute('href', '/applications');
    await waitFor(() => expect(tile('Clusters')).toHaveAttribute('href', '/infrastructure'));
  });

  it('does not link the clusters tile for users without infrastructure access', async () => {
    renderOverview({ username: 'alice' });

    await waitFor(() => expect(tile('Clusters')).toHaveTextContent('active'));
    expect(tile('Clusters')).not.toHaveAttribute('href');
  });

  it('drops the tiles and sections of a package the preset leaves out', async () => {
    renderOverview({ preset: { modules: ['overview', 'infrastructure'] } });

    await waitFor(() => expect(tile('Clusters')).toHaveTextContent('active'));
    expect(summary().queryByText('Applications', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.queryByText('Recent applications')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-empty')).not.toBeInTheDocument();
  });

  it('has no clusters tile without the infrastructure package', async () => {
    renderOverview({ preset: { modules: ['overview', 'applications'] } });

    await waitFor(() => expect(tile('Applications')).toHaveTextContent('3'));
    expect(summary().queryByText('Clusters', { selector: 'span' })).not.toBeInTheDocument();
  });

  it('says so when no enabled feature contributes anything', async () => {
    renderOverview({ preset: { modules: ['overview'] } });

    expect(await screen.findByText('Nothing to show yet')).toBeVisible();
    expect(screen.getByTestId('overview-summary')).toBeEmptyDOMElement();
  });

  it('lists services that cannot be scheduled under "Needs attention"', async () => {
    renderOverview();

    const card = await screen.findByTestId('needs-attention');
    const row = await within(card).findByRole('link', { name: /trainer/ });
    const service = mockStore.data.services.find((s) => s.microservice_name === 'trainer')!;
    expect(row).toHaveAttribute(
      'href',
      `/applications/${service.applicationID}/services/${service._id}`,
    );
    expect(within(row).getByTestId('status-badge')).toHaveTextContent('No capacity');
  });

  it('links recent applications to their detail page', async () => {
    renderOverview({ username: 'alice' });

    const link = await screen.findByRole('link', { name: /analytics/ });
    const app = mockStore.data.applications.find((a) => a.userId === 'alice')!;
    expect(link).toHaveAttribute('href', `/applications/${app._id}`);
  });

  it('creates an application from the recent applications and opens it', async () => {
    const { user, router } = renderOverview({ username: 'alice' });

    const section = await screen.findByTestId('recent-applications');
    // The button stays disabled until the applications have loaded; clicking it earlier is a no-op.
    const button = within(section).getByRole('button', { name: /New application/ });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'New application' });
    await user.type(within(dialog).getByLabelText('Name'), 'fresh');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    const created = await waitFor(() => {
      const app = mockStore.data.applications.find((a) => a.application_name === 'fresh');
      expect(app).toBeDefined();
      return app!;
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/applications/${created._id}`),
    );
  });

  it('guides users without applications through their first deployment', async () => {
    const { user } = renderOverview({ username: 'dave' });

    const card = await screen.findByTestId('getting-started');
    expect(within(card).getByText('Deploy your first service')).toBeVisible();
    expect(tile('Applications')).toHaveTextContent('0');
    expect(screen.queryByTestId('needs-attention')).not.toBeInTheDocument();

    const button = within(card).getByRole('button', { name: /New application/ });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(await screen.findByRole('dialog', { name: 'New application' })).toBeVisible();
  });

  it('lets a contributed stat tile take its place between the built-in ones', async () => {
    renderOverview({
      contributions: {
        'home.widgets': [
          {
            id: 'quota',
            title: 'Quota',
            size: 'stat',
            order: 350,
            component: () => <p>quota tile</p>,
          },
        ],
      },
    });

    await screen.findByText('quota tile');
    await waitFor(() => expect(tile('Clusters')).toBeInTheDocument());
    const order = Array.from(
      screen.getByTestId('overview-summary').querySelectorAll('[data-testid="home-widget"]'),
      (element) => element.getAttribute('data-widget-id'),
    );
    expect(order).toEqual([
      'applications:applications',
      'applications:services',
      'applications:instances',
      'ext:quota',
      'infrastructure:clusters',
    ]);
  });
});
