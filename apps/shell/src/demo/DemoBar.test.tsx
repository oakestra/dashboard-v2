import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../test/render';
import { DemoBar } from './DemoBar';
import { startDemoTour } from './start-tour';
import { TOUR_SEEN_KEY } from './storage';

vi.mock('./start-tour', () => ({ startDemoTour: vi.fn(() => ({ stop: vi.fn() })) }));

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(startDemoTour).mockClear();
});

describe('DemoBar', () => {
  it('starts the tour once on the first visit', async () => {
    const first = renderWithProviders(<DemoBar />, { route: '/demo' });
    expect(await screen.findByText(/simulated data, resets when you reload/)).toBeVisible();
    await waitFor(() => expect(startDemoTour).toHaveBeenCalledTimes(1));
    expect(window.localStorage.getItem(TOUR_SEEN_KEY)).toBe('true');
    first.unmount();

    renderWithProviders(<DemoBar />, { route: '/demo' });
    await screen.findByText(/simulated data/);
    expect(startDemoTour).toHaveBeenCalledTimes(1);
  });

  it('restarts the tour on request and links to the repository', async () => {
    window.localStorage.setItem(TOUR_SEEN_KEY, 'true');
    const { user } = renderWithProviders(<DemoBar />, { route: '/demo' });

    expect(await screen.findByRole('link', { name: /View on GitHub/ })).toHaveAttribute(
      'href',
      'https://github.com/oakestra/dashboard-v2',
    );
    await user.click(screen.getByRole('button', { name: 'Take the tour' }));
    await waitFor(() => expect(startDemoTour).toHaveBeenCalledTimes(1));
  });

  it('reports the query as part of the current path', async () => {
    window.localStorage.setItem(TOUR_SEEN_KEY, 'true');
    const { user } = renderWithProviders(<DemoBar />, { route: '/applications?view=clusters' });
    await user.click(await screen.findByRole('button', { name: 'Take the tour' }));
    await waitFor(() => expect(startDemoTour).toHaveBeenCalledTimes(1));
    expect(vi.mocked(startDemoTour).mock.calls[0]![0].currentPath()).toBe(
      '/applications?view=clusters',
    );
  });
});
