import { renderInHost } from '@oakestra/dashboard-sdk/testing';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  ApplicationsTile,
  InstancesTile,
  NeedsAttention,
  RecentApplications,
  ServicesTile,
} from '.';

const addon = { addonId: 'applications', basePath: '/applications' };
const user = { username: 'alice', roles: ['Application_Provider'] };

const shop = { _id: 'a1', application_name: 'shop', application_desc: '', microservices: ['s1'] };
const services = [
  {
    _id: 's1',
    microservice_name: 'web',
    status: 'RUNNING',
    instance_list: [
      { instance_number: 0, status: 'RUNNING' },
      { instance_number: 1, status: 'FAILED' },
    ],
  },
  {
    _id: 's2',
    microservice_name: 'worker',
    status: 'NoActiveClusterWithCapacity',
    instance_list: [],
  },
];

function api(applications: readonly object[] = [shop]) {
  return {
    users: { get: () => Promise.resolve({ _id: 'u1', name: 'alice' } as never) },
    applications: { listForUser: () => Promise.resolve(applications as never) },
    services: { listForApplication: () => Promise.resolve(services as never) },
  };
}

function tile(label: string) {
  return screen
    .getByText(label, { selector: 'span' })
    .closest<HTMLElement>('[data-slot="stat-card"]')!;
}

describe('overview widgets', () => {
  it('count applications, services and instances, linking to the applications list', async () => {
    renderInHost(
      <>
        <ApplicationsTile />
        <ServicesTile />
        <InstancesTile />
      </>,
      { api: api(), addon, user },
    );

    await waitFor(() => expect(tile('Applications')).toHaveTextContent('1'));
    await waitFor(() => expect(tile('Services')).toHaveTextContent('2 need attention'));
    expect(tile('Instances')).toHaveTextContent('1/21 failed');
    for (const label of ['Applications', 'Services', 'Instances']) {
      expect(tile(label)).toHaveAttribute('href', '/applications');
    }
  });

  it('list the services that need attention, worst first, linking below the mount', async () => {
    renderInHost(<NeedsAttention />, { api: api(), addon, user });

    const card = await screen.findByTestId('needs-attention');
    const rows = await within(card).findAllByRole('link');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('web'),
      expect.stringContaining('worker'),
    ]);
    expect(rows[0]).toHaveAttribute('href', '/applications/a1/services/s1');
  });

  it('show recent applications with a way to create one', async () => {
    const events = userEvent.setup();
    renderInHost(<RecentApplications />, { api: api(), addon, user });

    const link = await screen.findByRole('link', { name: /shop/ });
    expect(link).toHaveAttribute('href', '/applications/a1');
    await events.click(screen.getByRole('button', { name: /New application/ }));
    expect(await screen.findByRole('dialog', { name: 'New application' })).toBeVisible();
  });

  it('guide someone without applications and render no attention list for them', async () => {
    renderInHost(
      <>
        <NeedsAttention />
        <RecentApplications />
      </>,
      { api: api([]), addon, user },
    );

    expect(await screen.findByText('Deploy your first service')).toBeVisible();
    expect(screen.queryByTestId('needs-attention')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent applications')).not.toBeInTheDocument();
  });

  it('show a failed load in place of the recent applications', async () => {
    renderInHost(<RecentApplications />, {
      api: { ...api(), applications: { listForUser: () => Promise.reject(new Error('down')) } },
      addon,
      user,
    });

    expect(await screen.findByText('Could not load your applications')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
