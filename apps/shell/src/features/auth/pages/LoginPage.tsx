import { zodResolver } from '@hookform/resolvers/zod';
import { isApiError, loginRequestSchema } from '@oakestra/api';
import { useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  Button,
  cn,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from '@oakestra/ui';
import { useMutation } from '@tanstack/react-query';
import { ChevronDownIcon, InfoIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { z } from 'zod';

import { useAuthSession, useAuthState } from '../../../core/auth/auth-context';
import { safeRedirectTarget } from '../../../core/auth/guards';
import { AuthCard } from '../components/AuthCard';

type LoginForm = z.input<typeof loginRequestSchema>;

function loginErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 401) return 'Invalid username or password.';
    if (error.status === 404) return 'There is no organization with this name.';
    return error.message;
  }
  return 'Login failed. Please try again.';
}

const LOGOUT_MESSAGES = {
  expired: 'Your session has expired. Please log in again.',
  'other-tab': 'You were logged out in another tab.',
} as const;

export function LoginPage() {
  const api = useOakestraApi();
  const auth = useAuthSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const logoutReason = useAuthState((state) => state.lastLogoutReason);
  const [withOrganization, setWithOrganization] = useState(false);

  const form = useForm<LoginForm, unknown, z.output<typeof loginRequestSchema>>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { username: '', password: '', organization_name: '' },
  });

  // Opening the organization field is a request to type in it.
  useEffect(() => {
    if (withOrganization) form.setFocus('organization_name');
  }, [withOrganization, form]);

  const login = useMutation({
    mutationFn: (credentials: z.output<typeof loginRequestSchema>) => api.auth.login(credentials),
    // The error is shown in the form; a toast would repeat it.
    meta: { silent: true },
    onSuccess: async (tokens, credentials) => {
      auth.login(tokens, credentials.organization_name);
      await navigate(safeRedirectTarget(searchParams.get('redirectTo')), { replace: true });
    },
  });

  const notice =
    logoutReason === 'expired' || logoutReason === 'other-tab'
      ? LOGOUT_MESSAGES[logoutReason]
      : null;

  return (
    <AuthCard title="Log in" description="Use your Oakestra account.">
      <form
        onSubmit={(event) => void form.handleSubmit((values) => login.mutate(values))(event)}
        noValidate
      >
        <FieldGroup>
          {notice && !login.isError ? (
            <Alert variant="info">
              <InfoIcon aria-hidden />
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}
          {login.isError ? (
            <Alert variant="destructive" data-testid="login-error">
              <AlertDescription>{loginErrorMessage(login.error)}</AlertDescription>
            </Alert>
          ) : null}
          <Field data-invalid={!!form.formState.errors.username}>
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input
              id="username"
              autoComplete="username"
              aria-invalid={!!form.formState.errors.username}
              {...form.register('username')}
            />
            <FieldError errors={[form.formState.errors.username]} />
          </Field>
          <Field data-invalid={!!form.formState.errors.password} className="relative">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!form.formState.errors.password}
              {...form.register('password')}
            />
            {/* Comes after the input in the DOM so Tab goes username -> password, but sits next
                to the label visually. w-auto! beats Field's `[&>*]:w-full`, which would stretch
                the link over the label. */}
            <Link
              to="/reset-password"
              className="text-muted-foreground absolute top-0 right-0 w-auto! text-sm underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
            <FieldError errors={[form.formState.errors.password]} />
          </Field>
          {/* A disclosure, not a link: it reveals the field in place and folds it away again.
              Folding it clears the value so a hidden organization is never sent. */}
          <div className="space-y-3">
            <button
              type="button"
              aria-expanded={withOrganization}
              aria-controls="organization-field"
              onClick={() => {
                if (withOrganization) form.setValue('organization_name', '');
                setWithOrganization(!withOrganization);
              }}
              className="text-muted-foreground hover:text-foreground aria-expanded:text-foreground focus-visible:ring-ring/50 -mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm outline-none focus-visible:ring-[3px]"
            >
              Log in to an organization
              <ChevronDownIcon
                aria-hidden
                className={cn(
                  'size-4 transition-transform motion-reduce:transition-none',
                  withOrganization && 'rotate-180',
                )}
              />
            </button>
            {withOrganization ? (
              <Field id="organization-field">
                <FieldLabel htmlFor="organization">Organization</FieldLabel>
                <Input
                  id="organization"
                  autoComplete="organization"
                  placeholder="Leave empty for the default organization"
                  {...form.register('organization_name')}
                />
              </Field>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? 'Logging in...' : 'Log in'}
          </Button>
          {import.meta.env.DEV && import.meta.env.MODE === 'mock' ? (
            <p className="text-muted-foreground text-center text-xs">
              Mock API: log in as Admin, alice, bob, carol or dave. The password is the username.
            </p>
          ) : null}
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
