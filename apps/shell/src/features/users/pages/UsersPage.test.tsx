import { http, HttpResponse } from '@oakestra/mocks';
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockServer, mockStore, TEST_API_URL } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { organizationKeys } from '../../organizations';
import { usersModule } from '../index';
import { userKeys } from '../keys';

function renderUsers(user?: Parameters<typeof renderApp>[0]['user'], route = '/users') {
  return renderApp({ modules: [usersModule], route, user });
}

function rowOf(name: string) {
  return screen.getByRole('row', { name: new RegExp(`^${name}\\b`) });
}

afterEach(() => vi.restoreAllMocks());

describe('<UsersPage>', () => {
  it('shows roles for admins where the organization listing knows them, "-" elsewhere', async () => {
    // dave is no member of the session's organization, so the backend cannot tell his roles.
    const root = mockStore.data.organizations.find((org) => org.name === 'root')!;
    const dave = mockStore.data.users.find((u) => u.name === 'dave')!;
    root.member = root.member.filter((m) => m.user_id !== dave._id);
    renderUsers();

    expect(await screen.findByRole('row', { name: /^dave/ })).toBeVisible();
    expect(within(rowOf('alice')).getByText('Application Provider')).toBeVisible();
    expect(within(rowOf('dave')).getByText('-', { selector: 'span' })).toBeVisible();
  });

  it('shows the roles error and keeps "Edit roles" disabled when the listing fails', async () => {
    mockServer.use(
      http.get(`${TEST_API_URL}/users/:organizationId`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    renderUsers();

    expect(await screen.findByText('Could not load the roles')).toBeVisible();
    expect(await screen.findByRole('row', { name: /^alice/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit roles of alice' })).toBeDisabled();
  });

  it('keeps "Edit roles" disabled while the roles are loading', async () => {
    mockServer.use(
      http.get(`${TEST_API_URL}/users/:organizationId`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return undefined;
      }),
    );
    renderUsers();

    expect(await screen.findByRole('row', { name: /^alice/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit roles of alice' })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit roles of alice' })).toBeEnabled(),
    );
  });

  it.each([
    [
      'role update',
      async (user: UserEvent) => {
        await user.click(await screen.findByRole('button', { name: 'Edit roles of alice' }));
        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('checkbox', { name: /Infrastructure Provider/ }));
        await user.click(within(dialog).getByRole('button', { name: 'Save roles' }));
      },
    ],
    [
      'delete',
      async (user: UserEvent) => {
        await user.click(await screen.findByRole('button', { name: 'Delete dave' }));
        await user.click(await screen.findByRole('button', { name: 'Delete user' }));
      },
    ],
  ])('a user %s also invalidates the organization queries', async (_name, act) => {
    const { user, services } = renderUsers();
    await screen.findByRole('row', { name: /^alice/ });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit roles of alice' })).toBeEnabled(),
    );
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries');

    await act(user);

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: organizationKeys.all }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: userKeys.all });
  });

  it('keeps search and role filter in the URL', async () => {
    const { user, router } = renderUsers(undefined, '/users?q=bo&role=Infrastructure_Provider');

    expect(await screen.findByRole('row', { name: /^bob/ })).toBeVisible();
    expect(screen.queryByRole('row', { name: /^alice/ })).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search Users' })).toHaveValue('bo');

    await user.clear(screen.getByRole('searchbox', { name: 'Search Users' }));
    await waitFor(() => expect(router.state.location.search).toBe('?role=Infrastructure_Provider'));

    await user.click(screen.getByRole('combobox', { name: 'Filter by role' }));
    await user.click(await screen.findByRole('option', { name: 'All roles' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByRole('row', { name: /^alice/ })).toBeVisible();
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
    expect(invalidate).toHaveBeenCalledWith({ queryKey: organizationKeys.all });
    const created = mockStore.data.users.find((u) => u.name === 'erin');
    expect(created).toMatchObject({ email: 'erin@example.com', password });

    await user.click(screen.getByRole('button', { name: /Download credentials/ }));
    expect(click).toHaveBeenCalledOnce();
    const text = await blobs[0]!.text();
    expect(text).toContain('Username: erin');
    expect(text).toContain(`Password: ${password}`);

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('row', { name: /^erin/ })).toBeVisible();
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

    await user.click(await screen.findByRole('button', { name: 'Edit roles of alice' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox', { name: /Infrastructure Provider/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save roles' }));

    await waitFor(() =>
      expect(body).toEqual({ roles: ['Application_Provider', 'Infrastructure_Provider'] }),
    );
  });

  it('deletes a user after confirmation but never the logged-in one', async () => {
    const { user } = renderUsers();

    expect(await screen.findByRole('button', { name: 'Delete Admin' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Delete dave' }));
    await user.click(await screen.findByRole('button', { name: 'Delete user' }));

    await waitFor(() => expect(mockStore.data.users.some((u) => u.name === 'dave')).toBe(false));
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^dave/ })).not.toBeInTheDocument(),
    );
  });

  it('refuses users without an admin role', async () => {
    renderUsers({ username: 'alice' });
    expect(await screen.findByText(/do not have permission/i)).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
