import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { mockStore } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { authModule } from '../index';

describe('password reset', () => {
  it('requests a link without revealing whether the user exists', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { user } = renderApp({ modules: [authModule], route: '/reset-password', user: null });

    await user.type(await screen.findByLabelText('Username'), 'nobody');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByTestId('reset-requested')).toBeVisible();
    expect(mockStore.data.resetTokens).toEqual([]);
  });

  it('sets a new password with the token from the email', async () => {
    mockStore.data.resetTokens.push({
      token: 't0ken',
      username: 'bob',
      expiresAt: Date.now() + 60_000,
    });
    const { user } = renderApp({
      modules: [authModule],
      route: '/reset-password/t0ken',
      user: null,
    });

    await user.type(await screen.findByLabelText('New password'), 'long-enough');
    await user.type(screen.getByLabelText('Repeat the new password'), 'long-enough');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByTestId('password-reset-done')).toBeVisible();
    expect(mockStore.data.users.find((u) => u.name === 'bob')?.password).toBe('long-enough');
  });

  it('shows the backend reason for an invalid link', async () => {
    const { user } = renderApp({
      modules: [authModule],
      route: '/reset-password/stale',
      user: null,
    });

    await user.type(await screen.findByLabelText('New password'), 'long-enough');
    await user.type(screen.getByLabelText('Repeat the new password'), 'long-enough');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('Link invalid! Please request a new one!')).toBeVisible();
  });
});
