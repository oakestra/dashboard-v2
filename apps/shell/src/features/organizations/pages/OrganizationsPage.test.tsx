import { http } from '@oakestra/mocks';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockServer, mockStore, TEST_API_URL } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { organizationsModule } from '../index';

function renderOrgs(route = '/organizations', user?: Parameters<typeof renderApp>[0]['user']) {
  return renderApp({ modules: [organizationsModule], route, user });
}

const orgByName = (name: string) => mockStore.data.organizations.find((o) => o.name === name)!;

describe('organizations list', () => {
  it('shows names and member counts', async () => {
    renderOrgs();
    const row = await screen.findByRole('row', { name: /^root/ });
    expect(within(row).getByText('5')).toBeVisible();
    expect(screen.getByRole('row', { name: /^edge-lab/ })).toBeVisible();
  });

  it('creates an organization', async () => {
    let body: unknown;
    mockServer.use(
      http.post(`${TEST_API_URL}/organization/`, async ({ request }) => {
        body = await request.clone().json();
        // Returning nothing falls through to the default handler.
        return undefined;
      }),
    );
    const { user } = renderOrgs();
    await user.click(await screen.findByRole('button', { name: 'Create organization' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'campus');
    await user.click(within(dialog).getByRole('button', { name: 'Create organization' }));

    expect(await screen.findByRole('row', { name: /^campus/ })).toBeVisible();
    expect(body).toEqual({ name: 'campus', member: [] });
    expect(orgByName('campus').member).toEqual([]);
  });

  it('deletes an organization after confirmation', async () => {
    const { user } = renderOrgs();
    await user.click(await screen.findByRole('button', { name: 'Delete edge-lab' }));
    await user.click(await screen.findByRole('button', { name: 'Delete organization' }));

    await waitFor(() =>
      expect(mockStore.data.organizations.some((o) => o.name === 'edge-lab')).toBe(false),
    );
  });

  it('does not offer deleting the root organization', async () => {
    renderOrgs();
    expect(await screen.findByRole('button', { name: 'Delete root' })).toBeDisabled();
  });

  it('refuses users without the Admin role', async () => {
    renderOrgs('/organizations', { username: 'carol' });
    expect(await screen.findByText(/do not have permission/i)).toBeVisible();
  });
});

describe('organization detail', () => {
  it('resolves member names and sends the full member list when adding', async () => {
    const edge = orgByName('edge-lab');
    let body: unknown;
    mockServer.use(
      http.put(`${TEST_API_URL}/organization/:id`, async ({ request }) => {
        body = await request.clone().json();
        return undefined;
      }),
    );
    const { user } = renderOrgs(`/organizations/${edge._id}`);

    await user.click(await screen.findByRole('button', { name: 'Add member' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: 'User' }));
    await user.click(await screen.findByRole('option', { name: 'bob' }));
    await user.click(within(dialog).getByRole('checkbox', { name: /Infrastructure Provider/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add member' }));

    const bob = mockStore.data.users.find((u) => u.name === 'bob')!;
    const expected = {
      name: 'edge-lab',
      member: [{ user_id: bob._id, roles: ['Infrastructure_Provider'] }],
    };
    await waitFor(() => expect(body).toEqual(expected));
    expect(await screen.findByRole('row', { name: /^bob/ })).toBeVisible();
  });

  it('edits roles and removes a member', async () => {
    const root = orgByName('root');
    const { user } = renderOrgs(`/organizations/${root._id}`);

    await user.click(await screen.findByRole('button', { name: 'Edit roles of alice' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox', { name: /Infrastructure Provider/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save roles' }));

    const alice = mockStore.data.users.find((u) => u.name === 'alice')!;
    await waitFor(() =>
      expect(orgByName('root').member.find((m) => m.user_id === alice._id)?.roles).toEqual([
        'Application_Provider',
        'Infrastructure_Provider',
      ]),
    );

    await user.click(await screen.findByRole('button', { name: 'Remove alice' }));
    await user.click(await screen.findByRole('button', { name: 'Remove member' }));
    await waitFor(() =>
      expect(orgByName('root').member.some((m) => m.user_id === alice._id)).toBe(false),
    );
    expect(orgByName('root').member).toHaveLength(4);
  });

  it('renames an organization and keeps its members', async () => {
    const edge = orgByName('edge-lab');
    edge.member = [{ user_id: mockStore.data.users[1]!._id, roles: ['Application_Provider'] }];
    const members = structuredClone(edge.member);
    let body: unknown;
    mockServer.use(
      http.put(`${TEST_API_URL}/organization/:id`, async ({ request }) => {
        body = await request.clone().json();
        return undefined;
      }),
    );
    const { user } = renderOrgs(`/organizations/${edge._id}`);

    await user.click(await screen.findByRole('button', { name: 'Rename' }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'campus');
    await user.click(within(dialog).getByRole('button', { name: 'Rename' }));

    expect(await screen.findByRole('heading', { name: 'campus' })).toBeVisible();
    expect(body).toEqual({ name: 'campus', member: members });
    // The crumb comes from the route loader, which reruns after the rename.
    await waitFor(() =>
      expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Organizationscampus'),
    );
    expect(orgByName('campus').member).toEqual(members);
  });

  it('does not offer renaming the root organization', async () => {
    renderOrgs(`/organizations/${orgByName('root')._id}`);
    expect(await screen.findByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  it('does not let you remove yourself', async () => {
    renderOrgs(`/organizations/${orgByName('root')._id}`);
    expect(await screen.findByRole('button', { name: 'Remove Admin' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove alice' })).toBeEnabled();
  });

  it('refuses to demote the last Admin of the root organization', async () => {
    const root = orgByName('root');
    const { user } = renderOrgs(`/organizations/${root._id}`);

    await user.click(await screen.findByRole('button', { name: 'Edit roles of Admin' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox', { name: /^Admin/ }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/at least one Admin/);
    expect(within(dialog).getByRole('button', { name: 'Save roles' })).toBeDisabled();
  });

  it('allows demoting an Admin of another organization or of a root with a second Admin', async () => {
    const root = orgByName('root');
    const alice = mockStore.data.users.find((u) => u.name === 'alice')!;
    root.member.find((m) => m.user_id === alice._id)!.roles.push('Admin');
    const { user } = renderOrgs(`/organizations/${root._id}`);

    await user.click(await screen.findByRole('button', { name: 'Edit roles of alice' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox', { name: /^Admin/ }));

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save roles' })).toBeEnabled();
  });

  it('shows a not-found state for an unknown organization', async () => {
    renderOrgs('/organizations/nope');
    expect(await screen.findByText('Organization not found')).toBeVisible();
  });
});
