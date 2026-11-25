import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen } from '@testing-library/react';
import { ADDON_ID } from 'virtual:oakestra-addon';
import { describe, expect, it } from 'vitest';

import { ApplicationTab } from './ApplicationTab';

const hostFor = (name: string) => ({
  addon: { addonId: ADDON_ID },
  api: {
    applications: {
      get: () => Promise.resolve({ _id: 'app-1', application_name: name } as never),
    },
  },
});

describe('ApplicationTab', () => {
  it('shows the project linked to mlbatch', async () => {
    renderInHost(<ApplicationTab applicationId="app-1" />, hostFor('mlbatch'));
    expect(await screen.findByText('Defect detection plant Leipzig')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open project' }).getAttribute('href')).toBe(
      `/addons/${ADDON_ID}/projects/defect-leipzig`,
    );
  });

  it('explains that another application is not part of a project', async () => {
    renderInHost(<ApplicationTab applicationId="app-1" />, hostFor('webshop'));
    expect(await screen.findByText('Not part of a federated learning project')).toBeTruthy();
  });
});
