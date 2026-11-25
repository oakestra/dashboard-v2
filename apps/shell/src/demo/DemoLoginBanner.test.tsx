import { screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../test/render';
import { DemoLoginBanner } from './DemoLoginBanner';

function LoginForm({
  onLogin,
}: {
  onLogin: (values: { username: string; password: string }) => void;
}) {
  const form = useForm({ defaultValues: { username: '', password: '' } });
  return (
    <>
      <DemoLoginBanner setValue={form.setValue} />
      <form onSubmit={(event) => void form.handleSubmit(onLogin)(event)}>
        <label>
          Username
          <input {...form.register('username')} />
        </label>
        <label>
          Password
          <input type="password" {...form.register('password')} />
        </label>
        <button type="submit">Log in</button>
      </form>
    </>
  );
}

describe('DemoLoginBanner', () => {
  it('fills the login form with the demo account', async () => {
    const onLogin = vi.fn();
    const { user } = renderWithProviders(<LoginForm onLogin={onLogin} />, { route: '/demo' });

    expect(await screen.findByText(/live demo with simulated clusters/)).toBeVisible();
    expect(screen.getByLabelText('Username')).toHaveValue('Admin');
    expect(screen.getByLabelText('Password')).toHaveValue('Admin');

    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(onLogin).toHaveBeenCalledWith(
      { username: 'Admin', password: 'Admin' },
      expect.anything(),
    );
  });
});
