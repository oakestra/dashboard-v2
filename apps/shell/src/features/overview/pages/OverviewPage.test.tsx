import type { Contributions, Widget } from '@oakestra/dashboard-sdk';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderApp } from '../../../test/render';
import { overviewModule } from '../index';

// Only the page's own layout. The tiles the shell ships with come from the linked packages and
// are tested with them in src/linked/overview.test.tsx.
function renderOverview(widgets: readonly Widget[]) {
  const contributions: Contributions = { 'home.widgets': widgets };
  return renderApp({
    modules: [overviewModule, { id: 'ext', label: 'Ext', routes: [], contributions }],
    route: '/',
  });
}

const widget = (id: string, extra: Partial<Widget> = {}): Widget => ({
  id,
  title: `Title ${id}`,
  component: () => <p>body {id}</p>,
  ...extra,
});

function idsIn(testId: string) {
  return Array.from(
    screen.getByTestId(testId).querySelectorAll('[data-testid="home-widget"]'),
    (element) => element.getAttribute('data-widget-id'),
  );
}

describe('<OverviewPage>', () => {
  it('greets the user', async () => {
    renderOverview([]);

    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeVisible();
    expect(screen.getByText('Welcome back, Admin.')).toBeVisible();
  });

  it('shows an empty state when nothing is contributed', async () => {
    renderOverview([]);

    expect(await screen.findByText('Nothing to show yet')).toBeVisible();
    expect(screen.getByTestId('overview-summary')).toBeEmptyDOMElement();
    expect(screen.getByTestId('home-widgets')).toBeEmptyDOMElement();
  });

  it('lays widgets out by size: stat tiles on top, wide sections, then the card grid', async () => {
    renderOverview([
      widget('card'),
      widget('wide-b', { size: 'wide', order: 2 }),
      widget('stat', { size: 'stat' }),
      widget('wide-a', { size: 'wide', order: 1 }),
      widget('explicit-card', { size: 'card' }),
    ]);

    await screen.findByText('body stat');
    expect(idsIn('overview-summary')).toEqual(['ext:stat']);
    expect(idsIn('home-sections')).toEqual(['ext:wide-a', 'ext:wide-b']);
    expect(idsIn('home-widgets')).toEqual(['ext:card', 'ext:explicit-card']);
    expect(screen.queryByText('Nothing to show yet')).not.toBeInTheDocument();
  });

  it('frames only card widgets, with their title', async () => {
    renderOverview([widget('card'), widget('stat', { size: 'stat' })]);

    const card = within(await screen.findByTestId('home-widgets')).getByTestId('home-widget');
    expect(within(card).getByText('Title card')).toBeVisible();
    expect(within(card).getByText('body card')).toBeVisible();
    // Stat and wide widgets draw their own frame, so the title is not repeated above them.
    expect(screen.queryByText('Title stat')).not.toBeInTheDocument();
  });

  it('isolates a crashing tile to its own place in the summary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderOverview([
      widget('broken', {
        size: 'stat',
        component: () => {
          throw new Error('boom');
        },
      }),
      widget('fine', { size: 'stat' }),
    ]);

    const summary = within(await screen.findByTestId('overview-summary'));
    expect(await summary.findByTestId('contribution-error')).toHaveTextContent('Title broken');
    expect(summary.getByText('body fine')).toBeVisible();
  });
});
