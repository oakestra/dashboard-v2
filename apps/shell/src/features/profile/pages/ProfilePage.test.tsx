import { http, HttpResponse } from '@oakestra/mocks';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockServer, mockStore, TEST_API_URL } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { profileModule } from '../index';

function renderProfile(user?: Parameters<typeof renderApp>[0]['user']) {
  return renderApp({ modules: [profileModule], route: '/profile', user });
}

describe('<ProfilePage>', () => {
  it('shows the account from the backend and the roles', async () => {
    renderProfile({ username: 'alice' });

    expect(await screen.findByTestId('account-email')).toHaveTextContent('alice@example.com');
    expect(screen.getByTestId('account-username')).toHaveTextContent('alice');
    expect(within(screen.getByTestId('roles')).getByText('Application Provider')).toBeVisible();
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Profile');
  });

  it('lets an admin update the email address', async () => {
    const { user } = renderProfile();
    const input = await screen.findByRole('textbox', { name: 'Email address' });

    await user.clear(input);
    await user.type(input, 'admin@example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.getByTestId('account-email')).toHaveTextContent('admin@example.com'),
    );
    expect(mockStore.data.users.find((u) => u.name === 'Admin')?.email).toBe('admin@example.com');
  });

  it('validates the email address before sending it', async () => {
    const { user } = renderProfile();
    const input = await screen.findByRole('textbox', { name: 'Email address' });

    await user.clear(input);
    await user.type(input, 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Enter a valid email address')).toBeVisible();
  });

  it('keeps the email read-only for non-admins, as the backend would refuse it', async () => {
    renderProfile({ username: 'alice' });

    expect(await screen.findByRole('textbox', { name: 'Email address' })).toBeDisabled();
    expect(screen.getByText('Ask an administrator to change your email address.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('shows why a password change was rejected and succeeds with the right password', async () => {
    const { user } = renderProfile({ username: 'alice' });
    await user.click(await screen.findByRole('button', { name: 'Change password' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('Current password'), 'wrong-password');
    await user.type(within(dialog).getByLabelText('New password'), 'a-better-password');
    await user.type(within(dialog).getByLabelText('Repeat the new password'), 'a-better-password');
    await user.click(within(dialog).getByRole('button', { name: 'Change password' }));
    expect(await within(dialog).findByTestId('change-password-error')).toHaveTextContent(
      'Old password is not valid!',
    );

    const current = within(dialog).getByLabelText('Current password');
    await user.clear(current);
    await user.type(current, 'alice');
    await user.click(within(dialog).getByRole('button', { name: 'Change password' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockStore.data.users.find((u) => u.name === 'alice')?.password).toBe(
      'a-better-password',
    );
  });

  it('renders a load error inline', async () => {
    mockServer.use(
      http.get(`${TEST_API_URL}/user/:username`, () =>
        HttpResponse.json({ message: 'Database is down' }, { status: 500 }),
      ),
    );
    renderProfile();

    expect(await screen.findByText('Could not load your profile')).toBeVisible();
    expect(screen.getByText('Database is down')).toBeVisible();
  });
});
