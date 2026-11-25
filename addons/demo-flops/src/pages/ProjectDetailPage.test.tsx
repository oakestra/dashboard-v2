import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { fireEvent, screen } from '@testing-library/react';
import { ADDON_ID } from 'virtual:oakestra-addon';
import { describe, expect, it } from 'vitest';

import { ProjectDetailPage } from './ProjectDetailPage';

const path = `/addons/${ADDON_ID}/projects/:projectId`;

describe('ProjectDetailPage', () => {
  it('shows the learners and toasts when a round is started', async () => {
    const { notify } = renderInHost(<ProjectDetailPage />, {
      addon: { addonId: ADDON_ID },
      path,
      route: `/addons/${ADDON_ID}/projects/anomaly-sensors`,
    });
    expect(
      await screen.findByRole('heading', { name: 'Anomaly detection on sensor data' }),
    ).toBeTruthy();
    expect(screen.getByText('plant-leipzig')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /start new round/i }));
    expect(notify.calls.at(-1)?.message).toBe('Round 19 requested');
  });

  it('renders an empty state for an unknown project', async () => {
    renderInHost(<ProjectDetailPage />, {
      addon: { addonId: ADDON_ID },
      path,
      route: `/addons/${ADDON_ID}/projects/nope`,
    });
    expect(await screen.findByText('Project not found')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to projects' })).toBeTruthy();
  });
});
