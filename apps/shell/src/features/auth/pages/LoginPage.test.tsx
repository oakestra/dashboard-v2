import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { REFRESH_TOKEN_KEY } from '../../../core/auth/session';
import { renderApp } from '../../../test/render';
import { profileModule } from '../../profile';
import { authModule } from '../index';

const modules = [authModule, profileModule];

describe('login', () => {
  it('sends anonymous users to the login page and back to where they wanted to go', async () => {
    const { user, router } = renderApp({ modules, route: '/profile?tab=x', user: null });

    await screen.findByRole('heading', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?redirectTo=%2Fprofile%3Ftab%3Dx');

    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'alice');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeVisible();
    expect(router.state.location.pathname + router.state.location.search).toBe('/profile?tab=x');
    expect(window.localStorage.getItem(REFRESH_TOKEN_KEY)).toEqual(expect.any(String));
  });

  it('explains wrong credentials and unknown organizations', async () => {
    const { user } = renderApp({ modules, route: '/login', user: null });

    await user.type(await screen.findByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByTestId('login-error')).toHaveTextContent(
      'Invalid username or password.',
    );

    await user.click(screen.getByRole('button', { name: 'Log in to an organization' }));
    await user.type(screen.getByLabelText('Organization'), 'nowhere');
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'alice');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(screen.getByTestId('login-error')).toHaveTextContent(
        'There is no organization with this name.',
      ),
    );
  });

  it('tabs from the username straight to the password field', async () => {
    const { user } = renderApp({ modules, route: '/login', user: null });

    await user.click(await screen.findByLabelText('Username'));
    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveFocus();
  });

  it('logs into a named organization and shows it in the header', async () => {
    const { user } = renderApp({ modules, route: '/login', user: null });

    await user.type(await screen.findByLabelText('Username'), 'Admin');
    await user.type(screen.getByLabelText('Password'), 'Admin');
    await user.click(screen.getByRole('button', { name: 'Log in to an organization' }));
    await user.type(screen.getByLabelText('Organization'), 'edge-lab');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByTestId('organization-badge')).toHaveTextContent('edge-lab');
  });

  it('skips the login page when a session exists', async () => {
    const { router } = renderApp({ modules, route: '/login?redirectTo=/profile' });
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/profile');
  });

  it('never redirects to another origin after login', async () => {
    const { router } = renderApp({ modules, route: '/login?redirectTo=//evil.example' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('logs out from the user menu and clears the session', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const { user, router, services } = renderApp({ modules, route: '/profile' });
    await screen.findByRole('heading', { name: 'Profile' });

    // Radix menus open on pointerdown, which user-event sends as part of click.
    await user.click(screen.getByTestId('user-menu'));
    await user.click(await screen.findByTestId('logout'));

    await screen.findByRole('heading', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
    // The profile page must not crash on the missing user while the redirect is pending.
    expect(consoleError).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(services.queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it('redirects the old reset link format of the backend emails', async () => {
    const { router } = renderApp({ modules, route: '/resetPassword/abc', user: null });
    await screen.findByRole('heading', { name: 'Choose a new password' });
    expect(router.state.location.pathname).toBe('/reset-password/abc');
  });
});
