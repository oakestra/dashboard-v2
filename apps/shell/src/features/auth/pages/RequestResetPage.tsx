import { zodResolver } from '@hookform/resolvers/zod';
import { isApiError } from '@oakestra/api';
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
import { Link } from 'react-router';
import { z } from 'zod';

import { describeError } from '../../../core/api/errors';
import { AuthCard } from '../components/AuthCard';

const schema = z.object({ username: z.string().trim().min(1, 'Enter your username') });

export function RequestResetPage() {
  const api = useOakestraApi();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { username: '' } });
  const request = useMutation({
    mutationFn: async ({ username }: z.output<typeof schema>) => {
      try {
        await api.auth.requestPasswordReset({ username, domain: window.location.host });
      } catch (error) {
        // Unknown users get the same answer as known ones, so the form cannot be used to find out
        // which usernames exist.
        if (isApiError(error) && error.status === 404) return;
        throw error;
      }
    },
    meta: { silent: true },
  });

  if (request.isSuccess) {
    return (
      <AuthCard title="Check your email">
        <div className="space-y-4" data-testid="reset-requested">
          <p className="text-muted-foreground text-sm">
            If the account exists and has an email address, a link to choose a new password is on
            its way.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">Back to login</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="We will email you a link to choose a new password."
    >
      <form
        onSubmit={(event) => void form.handleSubmit((values) => request.mutate(values))(event)}
        noValidate
      >
        <FieldGroup>
          {request.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{describeError(request.error)}</AlertDescription>
            </Alert>
          ) : null}
          <Field data-invalid={!!form.formState.errors.username}>
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input id="username" autoComplete="username" {...form.register('username')} />
            <FieldError errors={[form.formState.errors.username]} />
          </Field>
          <Button type="submit" className="w-full" disabled={request.isPending}>
            Send reset link
          </Button>
          <Button asChild variant="link" className="h-auto p-0">
            <Link to="/login">Back to login</Link>
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
