import { Button } from '@oakestra/ui';
import type { RefObject } from 'react';

export const DEMO_CREDENTIALS = { username: 'Admin', password: 'Admin' } as const;

export interface DemoLoginBannerProps {
  /** The login form's `setValue` (react-hook-form). */
  setValue: (
    name: 'username' | 'password',
    value: string,
    options: { shouldValidate: boolean },
  ) => void;
  /** The form's submit button: focused after filling in, clicked to log in right away. */
  submitRef: RefObject<HTMLButtonElement | null>;
}

/** Login page notice in the static demo, with the demo account and a shortcut to use it. */
export function DemoLoginBanner({ setValue, submitRef }: DemoLoginBannerProps) {
  const fill = () => {
    // Validated at once, so an error left over from an empty submit disappears.
    setValue('username', DEMO_CREDENTIALS.username, { shouldValidate: true });
    setValue('password', DEMO_CREDENTIALS.password, { shouldValidate: true });
  };

  return (
    <div data-oakestra-demo="login" className="bg-muted/40 space-y-3 rounded-lg border p-4 text-sm">
      <div className="space-y-1">
        <p className="font-medium">This is a live demo with simulated clusters and data.</p>
        <p className="text-muted-foreground">
          Log in as <span className="text-foreground font-medium">{DEMO_CREDENTIALS.username}</span>{' '}
          with the password{' '}
          <span className="text-foreground font-medium">{DEMO_CREDENTIALS.password}</span>.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            fill();
            submitRef.current?.focus();
          }}
        >
          Fill in
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            fill();
            submitRef.current?.click();
          }}
        >
          Log in as demo user
        </Button>
      </div>
    </div>
  );
}
