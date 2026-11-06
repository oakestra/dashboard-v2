import { http, HttpResponse } from '@oakestra/mocks';
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { linkedAddons } from '../app/modules';
import { mockServer, mockStore, TEST_API_URL } from '../test/msw';
import { renderApp } from '../test/render';

import { platformQueryKeys } from '@oakestra/dashboard-sdk';

function renderUsers(user?: Parameters<typeof renderApp>[0]['user'], route = '/users') {
  return renderApp({ linked: linkedAddons, route, user });
}

// Scoped to the list, the header shows the name of the logged-in user too.
const inList = { selector: '[aria-label="Users"] [data-slot="item-title"] span' };

const rowOf = (name: string) => screen.getByText(name, inList).closest('li')!;
const queryRow = (name: string) => screen.queryByText(name, inList);
const findRow = async (name: string) => (await screen.findByText(name, inList)).closest('li')!;

// Items render before the organization listing has answered.
const rolesLoaded = () =>
  waitFor(() => expect(within(rowOf('alice')).getByText('Application Provider')).toBeVisible());

async function openActions(user: UserEvent, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
}

afterEach(() => vi.restoreAllMocks());

// The users package in the real shell: router, layout, role guard and MSW backend.
describe('users (linked addon)', () => {
  it('shows roles for admins where the organization listing knows them', async () => {
    // dave is no member of the session's organization, so the backend cannot tell his roles.
    const root = mockStore.data.organizations.find((org) => org.name === 'root')!;
    const dave = mockStore.data.users.find((u) => u.name === 'dave')!;
    root.member = root.member.filter((m) => m.user_id !== dave._id);
    renderUsers();

    expect(await findRow('dave')).toBeVisible();
    expect(within(rowOf('alice')).getByText('Application Provider')).toBeVisible();
    expect(within(rowOf('dave')).getByText('Roles unknown')).toBeVisible();
  });

  it('shows the roles error and keeps "Edit roles" disabled when the listing fails', async () => {
    mockServer.use(
      http.get(`${TEST_API_URL}/users/:organizationId`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    const { user } = renderUsers();

    expect(await screen.findByText('Could not load the roles')).toBeVisible();
    expect(await findRow('alice')).toBeVisible();
    await openActions(user, 'alice');
    expect(screen.getByRole('menuitem', { name: 'Edit roles' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('keeps "Edit roles" disabled while the roles are loading', async () => {
    // Held until the test releases it: a fixed delay raced the menu under load.
    let releaseRoles = () => {};
    const rolesHeld = new Promise<void>((resolve) => {
      releaseRoles = resolve;
    });
    mockServer.use(
      http.get(`${TEST_API_URL}/users/:organizationId`, async () => {
        await rolesHeld;
        return undefined;
      }),
    );
    const { user } = renderUsers();

    expect(await findRow('alice')).toBeVisible();
    await openActions(user, 'alice');
    expect(screen.getByRole('menuitem', { name: 'Edit roles' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.keyboard('{Escape}');
    releaseRoles();
    await rolesLoaded();
    await openActions(user, 'alice');
    expect(screen.getByRole('menuitem', { name: 'Edit roles' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it.each([
    [
      'role update',
      async (user: UserEvent) => {
        await openActions(user, 'alice');
        await user.click(await screen.findByRole('menuitem', { name: 'Edit roles' }));
        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('checkbox', { name: /Infrastructure Provider/ }));
        await user.click(within(dialog).getByRole('button', { name: 'Save roles' }));
      },
    ],
    [
      'delete',
      async (user: UserEvent) => {
        await openActions(user, 'dave');
        await user.click(await screen.findByRole('menuitem', { name: 'Delete user' }));
        await user.click(await screen.findByRole('button', { name: 'Delete user' }));
      },
    ],
  ])('a user %s also invalidates the organization queries', async (_name, act) => {
    const { user, services } = renderUsers();
    await findRow('alice');
    await rolesLoaded();
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries');

    await act(user);

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: platformQueryKeys.organizations() }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: platformQueryKeys.users() });
  });

  it('keeps search and role filter in the URL', async () => {
    const { user, router } = renderUsers(undefined, '/users?q=bo&role=Infrastructure_Provider');

    expect(await findRow('bob')).toBeVisible();
    expect(queryRow('alice')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search Users' })).toHaveValue('bo');

    await user.clear(screen.getByRole('searchbox', { name: 'Search Users' }));
    await waitFor(() => expect(router.state.location.search).toBe('?role=Infrastructure_Provider'));

    await user.click(screen.getByRole('combobox', { name: 'Filter by role' }));
    await user.click(await screen.findByRole('option', { name: 'All roles' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await findRow('alice')).toBeVisible();
  });

  it('creates a user and offers the credentials as a download', async () => {
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:credentials';
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user, services } = renderUsers();
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries');

    await user.click(await screen.findByRole('button', { name: 'Create user' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Username'), 'erin');
    await user.type(within(dialog).getByLabelText('Email address'), 'erin@example.com');
    await user.click(within(dialog).getByRole('button', { name: /Generate/ }));
    const password = within(dialog).getByLabelText<HTMLInputElement>('Password').value;
    expect(password).toHaveLength(16);
    await user.click(within(dialog).getByRole('checkbox', { name: /Application Provider/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }));

    expect(await screen.findByTestId('user-created')).toHaveTextContent(password);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: platformQueryKeys.organizations() });
    const created = mockStore.data.users.find((u) => u.name === 'erin');
    expect(created).toMatchObject({ email: 'erin@example.com', password });

    await user.click(screen.getByRole('button', { name: /Download credentials/ }));
    expect(click).toHaveBeenCalledOnce();
    const text = await blobs[0]!.text();
    expect(text).toContain('Username: erin');
    expect(text).toContain(`Password: ${password}`);

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await findRow('erin')).toBeVisible();
  });

  it('shows the backend reason when the username is taken', async () => {
    const { user } = renderUsers();
    await user.click(await screen.findByRole('button', { name: 'Create user' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Username'), 'alice');
    await user.type(within(dialog).getByLabelText('Email address'), 'a@example.com');
    await user.type(within(dialog).getByLabelText('Password'), 'password-123');
    await user.click(within(dialog).getByRole('checkbox', { name: /^Admin/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }));

    expect(await screen.findByTestId('create-user-error')).toHaveTextContent(
      'Username already exists',
    );
  });

  it('sends only the roles when editing', async () => {
    let body: unknown;
    mockServer.use(
      http.put(`${TEST_API_URL}/user/:username`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json('ok');
      }),
    );
    const { user } = renderUsers();

    await rolesLoaded();
    await openActions(user, 'alice');
    await user.click(await screen.findByRole('menuitem', { name: 'Edit roles' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox', { name: /Infrastructure Provider/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save roles' }));

    await waitFor(() =>
      expect(body).toEqual({ roles: ['Application_Provider', 'Infrastructure_Provider'] }),
    );
  });

  it('deletes a user after confirmation but never the logged-in one', async () => {
    const { user } = renderUsers();

    await openActions(user, 'Admin');
    expect(await screen.findByRole('menuitem', { name: 'Edit roles' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Delete user' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await openActions(user, 'dave');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete user' }));
    await user.click(await screen.findByRole('button', { name: 'Delete user' }));

    await waitFor(() => expect(mockStore.data.users.some((u) => u.name === 'dave')).toBe(false));
    await waitFor(() => expect(queryRow('dave')).not.toBeInTheDocument());
  });

  it('sorts by creation date, not by the legacy string', async () => {
    // As strings 31/07 would sort after 01/11.
    mockStore.data.users.find((u) => u.name === 'alice')!.created_at = '31/07/2026 22:49';
    mockStore.data.users.find((u) => u.name === 'bob')!.created_at = '01/11/2026, 16:34';
    const { user } = renderUsers();
    await findRow('alice');

    await user.click(screen.getByRole('combobox', { name: 'Sort Users' }));
    await user.click(await screen.findByRole('option', { name: 'Oldest first' }));

    await waitFor(() => {
      const items = within(screen.getByRole('list', { name: 'Users' })).getAllByRole('listitem');
      expect(items.indexOf(rowOf('alice'))).toBeLessThan(items.indexOf(rowOf('bob')));
    });
  });

  it('marks the own item and offers to clear a role filter without matches', async () => {
    const { user } = renderUsers(undefined, '/users?role=Nobody');

    expect(await screen.findByText('No users with this role')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(within(await findRow('Admin')).getByText('You')).toBeVisible();
  });

  it('refuses users without an admin role', async () => {
    renderUsers({ username: 'alice' });
    expect(await screen.findByText(/do not have permission/i)).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Users' })).not.toBeInTheDocument();
  });
});
