import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen } from '@testing-library/react';
import { ADDON_ID } from 'virtual:oakestra-addon';
import { describe, expect, it } from 'vitest';

import { ProjectsPage } from './ProjectsPage';

describe('ProjectsPage', () => {
  it('lists the projects with their status and summary tiles', async () => {
    renderInHost(<ProjectsPage />, { addon: { addonId: ADDON_ID } });
    expect(await screen.findByText('Anomaly detection on sensor data')).toBeTruthy();
    expect(screen.getByText('Next-word keyboard model')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('Active projects')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Defect detection plant Leipzig' });
    expect(link.getAttribute('href')).toBe(`/addons/${ADDON_ID}/projects/defect-leipzig`);
  });
});
