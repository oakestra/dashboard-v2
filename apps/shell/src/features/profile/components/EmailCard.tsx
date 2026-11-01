import { zodResolver } from '@hookform/resolvers/zod';
import { usePermissions } from '@oakestra/dashboard-sdk';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
} from '@oakestra/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useUpdateEmail } from '../api/mutations';

const schema = z.object({ email: z.email('Enter a valid email address') });

export function EmailCard({ username, email }: { username: string; email: string }) {
  // The backend lets only admins change user records, including their own.
  const canEdit = usePermissions().hasRole('Admin');
  const update = useUpdateEmail(username);
  const form = useForm({
    resolver: zodResolver(schema),
    // `values` instead of `defaultValues`: the form follows the server value after a refetch.
    values: { email },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email address</CardTitle>
        <CardDescription>Used for password reset links.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
          onSubmit={(event) =>
            void form.handleSubmit(({ email: next }) => update.mutate(next))(event)
          }
          noValidate
        >
          <Field data-invalid={!!form.formState.errors.email} className="flex-1">
            <FieldLabel htmlFor="email" className="sr-only">
              Email address
            </FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              disabled={!canEdit}
              aria-invalid={!!form.formState.errors.email}
              {...form.register('email')}
            />
            <FieldError errors={[form.formState.errors.email]} />
            {canEdit ? null : (
              <FieldDescription>
                Ask an administrator to change your email address.
              </FieldDescription>
            )}
          </Field>
          {canEdit ? (
            <Button type="submit" disabled={!form.formState.isDirty || update.isPending}>
              {update.isPending ? 'Saving...' : 'Save'}
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
