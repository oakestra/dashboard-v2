import { Button } from '@oakestra/ui';
import { screen } from '@testing-library/react';
import { useRef } from 'react';
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
  const submitRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <DemoLoginBanner setValue={form.setValue} submitRef={submitRef} />
      <form onSubmit={(event) => void form.handleSubmit(onLogin)(event)}>
        <label>
          Username
          <input {...form.register('username')} />
        </label>
        <label>
          Password
          <input type="password" {...form.register('password')} />
        </label>
        <Button ref={submitRef} type="submit">
          Log in
        </Button>
      </form>
    </>
  );
}

describe('DemoLoginBanner', () => {
  it('fills in the demo account and focuses the login button', async () => {
    const onLogin = vi.fn();
    const { user } = renderWithProviders(<LoginForm onLogin={onLogin} />, { route: '/demo' });

    expect(await screen.findByText(/live demo with simulated clusters/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Fill in' }));

    expect(screen.getByLabelText('Username')).toHaveValue('Admin');
    expect(screen.getByLabelText('Password')).toHaveValue('Admin');
    expect(screen.getByRole('button', { name: 'Log in' })).toHaveFocus();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('logs in as the demo user in one click', async () => {
    const onLogin = vi.fn();
    const { user } = renderWithProviders(<LoginForm onLogin={onLogin} />, { route: '/demo' });

    await user.click(await screen.findByRole('button', { name: 'Log in as demo user' }));
    expect(onLogin).toHaveBeenCalledWith(
      { username: 'Admin', password: 'Admin' },
      expect.anything(),
    );
  });
});
