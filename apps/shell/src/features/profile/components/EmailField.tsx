import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Field, FieldError, FieldLabel, Input } from '@oakestra/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useUpdateEmail } from '../api/mutations';

const schema = z.object({ email: z.email('Enter a valid email address') });

/** Inline email editor. Only rendered for admins: the backend refuses everybody else. */
export function EmailField({ username, email }: { username: string; email: string }) {
  const update = useUpdateEmail(username);
  const form = useForm({
    resolver: zodResolver(schema),
    // `values` instead of `defaultValues`: the form follows the server value after a refetch.
    values: { email },
  });

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
      onSubmit={(event) => void form.handleSubmit(({ email: next }) => update.mutate(next))(event)}
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
          placeholder="name@example.com"
          aria-invalid={!!form.formState.errors.email}
          {...form.register('email')}
        />
        <FieldError errors={[form.formState.errors.email]} />
      </Field>
      <Button type="submit" disabled={!form.formState.isDirty || update.isPending}>
        {update.isPending ? 'Saving...' : 'Save'}
      </Button>
    </form>
  );
}
