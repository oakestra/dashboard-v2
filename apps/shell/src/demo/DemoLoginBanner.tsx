import { useEffect } from 'react';

export const DEMO_CREDENTIALS = { username: 'Admin', password: 'Admin' } as const;

export interface DemoLoginBannerProps {
  /** The login form's `setValue` (react-hook-form). */
  setValue: (name: 'username' | 'password', value: string) => void;
}

/**
 * Login page notice in the static demo. It fills the form with the demo account, so visitors only
 * press the form's own "Log in" button.
 */
export function DemoLoginBanner({ setValue }: DemoLoginBannerProps) {
  useEffect(() => {
    setValue('username', DEMO_CREDENTIALS.username);
    setValue('password', DEMO_CREDENTIALS.password);
  }, [setValue]);

  return (
    <div data-oakestra-demo="login" className="bg-muted/40 space-y-1 rounded-lg border p-4 text-sm">
      <p className="font-medium">This is a live demo with simulated clusters and data.</p>
      <p className="text-muted-foreground">
        The form below is filled in with the demo account,{' '}
        <span className="text-foreground font-medium">{DEMO_CREDENTIALS.username}</span> with the
        password <span className="text-foreground font-medium">{DEMO_CREDENTIALS.password}</span>.
      </p>
    </div>
  );
}
