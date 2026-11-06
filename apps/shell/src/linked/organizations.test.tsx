import { http } from '@oakestra/mocks';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { linkedAddons } from '../app/modules';
import { mockServer, mockStore, TEST_API_URL } from '../test/msw';
import { renderApp } from '../test/render';

function renderOrgs(route = '/organizations', user?: Parameters<typeof renderApp>[0]['user']) {
  return renderApp({ linked: linkedAddons, route, user });
}

const orgByName = (name: string) => mockStore.data.organizations.find((o) => o.name === name)!;

// The organizations package in the real shell: router, layout, role guard and MSW backend.
describe('organizations list', () => {
  it('shows names and member counts', async () => {
    renderOrgs();
    const card = (await screen.findByRole('link', { name: 'root' })).closest('li')!;
    expect(within(card).getByText('5 members, 1 admin')).toBeVisible();
    expect(screen.getByRole('link', { name: 'edge-lab' })).toBeVisible();
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

    expect(await screen.findByRole('link', { name: 'campus' })).toBeVisible();
    expect(body).toEqual({ name: 'campus', member: [] });
    expect(orgByName('campus').member).toEqual([]);
  });

  it('deletes an organization after confirmation', async () => {
    const { user } = renderOrgs();
    await user.click(await screen.findByRole('button', { name: 'Actions for edge-lab' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete organization' }));
    await user.click(await screen.findByRole('button', { name: 'Delete organization' }));

    await waitFor(() =>
      expect(mockStore.data.organizations.some((o) => o.name === 'edge-lab')).toBe(false),
    );
  });

  it('keeps the search in the URL and opens an organization from its card', async () => {
    const { user, router } = renderOrgs('/organizations?q=edge');

    expect(await screen.findByRole('link', { name: 'edge-lab' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'root' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'edge-lab' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/organizations/${orgByName('edge-lab')._id}`),
    );
  });

  it('does not offer deleting the root organization', async () => {
    renderOrgs();
    await screen.findByRole('link', { name: 'root' });
    expect(screen.queryByRole('button', { name: 'Actions for root' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for edge-lab' })).toBeEnabled();
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

    // The empty state repeats the header's button.
    await screen.findByText('No members');
    await user.click(screen.getAllByRole('button', { name: 'Add member' })[0]!);
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
    const members = await screen.findByRole('list', { name: 'Members' });
    expect(await within(members).findByText('bob')).toBeVisible();
  });

  it('edits roles and removes a member', async () => {
    const root = orgByName('root');
    const { user } = renderOrgs(`/organizations/${root._id}`);

    await user.click(await screen.findByRole('button', { name: 'Actions for alice' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit roles' }));
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

    await user.click(await screen.findByRole('button', { name: 'Actions for alice' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove member' }));
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
    // The crumb reads the organization list the rename invalidated.
    await waitFor(() =>
      expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Organizationscampus'),
    );
    expect(orgByName('campus').member).toEqual(members);
  });

  it('does not offer renaming the root organization', async () => {
    renderOrgs(`/organizations/${orgByName('root')._id}`);
    expect(await screen.findByText(/cannot be renamed or deleted/)).toBeVisible();
    expect(screen.getByText('Default')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });

  it('summarizes the members and deletes a non-root organization from the header menu', async () => {
    const org = orgByName('edge-lab');
    const { user, router } = renderOrgs(`/organizations/${org._id}`);

    expect(await screen.findByTestId('member-summary')).toHaveTextContent(
      /\d+ members?, \d+ admins?/,
    );
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete organization' }));
    await user.click(await screen.findByRole('button', { name: 'Delete organization' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/organizations'));
    expect(mockStore.data.organizations.some((o) => o.name === 'edge-lab')).toBe(false);
  });

  it('explains when every user is already a member', async () => {
    const org = orgByName('edge-lab');
    org.member = mockStore.data.users.map((u) => ({ user_id: u._id, roles: ['Admin'] }));
    const { user } = renderOrgs(`/organizations/${org._id}`);

    await user.click(await screen.findByRole('button', { name: 'Add member' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('All users are members')).toBeVisible();
    expect(within(dialog).queryByRole('combobox', { name: 'User' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Create a user' })).toHaveAttribute(
      'href',
      '/users',
    );
  });

  it('does not offer to create a user when a preset drops the users module', async () => {
    const org = orgByName('edge-lab');
    org.member = mockStore.data.users.map((u) => ({ user_id: u._id, roles: ['Admin'] }));
    const { user } = renderApp({
      linked: linkedAddons,
      route: `/organizations/${org._id}`,
      preset: { modules: ['organizations'], home: '/organizations' },
    });

    await user.click(await screen.findByRole('button', { name: 'Add member' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('All users are members')).toBeVisible();
    expect(within(dialog).queryByRole('link', { name: 'Create a user' })).not.toBeInTheDocument();
  });

  it('does not let you remove yourself', async () => {
    const { user } = renderOrgs(`/organizations/${orgByName('root')._id}`);
    await user.click(await screen.findByRole('button', { name: 'Actions for Admin' }));
    expect(await screen.findByRole('menuitem', { name: 'Remove member' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Actions for alice' }));
    expect(await screen.findByRole('menuitem', { name: 'Remove member' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });

  it('refuses to demote the last Admin of the root organization', async () => {
    const root = orgByName('root');
    const { user } = renderOrgs(`/organizations/${root._id}`);

    await user.click(await screen.findByRole('button', { name: 'Actions for Admin' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit roles' }));
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

    await user.click(await screen.findByRole('button', { name: 'Actions for alice' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit roles' }));
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
