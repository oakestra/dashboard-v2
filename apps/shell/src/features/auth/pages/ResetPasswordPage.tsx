import { zodResolver } from '@hookform/resolvers/zod';
import { useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from '@oakestra/ui';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { z } from 'zod';

import { describeError } from '../../../core/api/errors';
import { AuthCard } from '../components/AuthCard';

const schema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'The passwords do not match',
    path: ['confirm'],
  });

export function ResetPasswordPage() {
  const { token = '' } = useParams();
  const api = useOakestraApi();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });
  const reset = useMutation({
    mutationFn: ({ password }: z.output<typeof schema>) =>
      api.auth.resetPassword({ token, password }),
    meta: { silent: true },
  });

  if (reset.isSuccess) {
    return (
      <AuthCard title="Password changed">
        <div className="space-y-4" data-testid="password-reset-done">
          <p className="text-muted-foreground text-sm">
            You can now log in with your new password.
          </p>
          <Button asChild className="w-full">
            <Link to="/login">Log in</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form
        onSubmit={(event) => void form.handleSubmit((values) => reset.mutate(values))(event)}
        noValidate
      >
        <FieldGroup>
          {reset.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{describeError(reset.error)}</AlertDescription>
            </Alert>
          ) : null}
          <Field data-invalid={!!form.formState.errors.password}>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...form.register('password')}
            />
            <FieldError errors={[form.formState.errors.password]} />
          </Field>
          <Field data-invalid={!!form.formState.errors.confirm}>
            <FieldLabel htmlFor="confirm">Repeat the new password</FieldLabel>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              {...form.register('confirm')}
            />
            <FieldError errors={[form.formState.errors.confirm]} />
          </Field>
          <Button type="submit" className="w-full" disabled={reset.isPending}>
            Change password
          </Button>
          <Button asChild variant="link" className="h-auto p-0">
            <Link to="/reset-password">Request a new link</Link>
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
