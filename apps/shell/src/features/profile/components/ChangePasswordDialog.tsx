import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from '@oakestra/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { describeError } from '../../../core/api/errors';
import { useChangePassword } from '../api/mutations';

const schema = z
  .object({
    oldPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
  })
  .refine((values) => values.newPassword === values.confirm, {
    message: 'The passwords do not match',
    path: ['confirm'],
  })
  .refine((values) => values.newPassword !== values.oldPassword, {
    message: 'Choose a password different from the current one',
    path: ['newPassword'],
  });

type FormValues = z.input<typeof schema>;
const EMPTY: FormValues = { oldPassword: '', newPassword: '', confirm: '' };

export function ChangePasswordDialog({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const change = useChangePassword(username);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      form.reset(EMPTY);
      change.reset();
    }
  };

  const fields = [
    { name: 'oldPassword', label: 'Current password', autoComplete: 'current-password' },
    { name: 'newPassword', label: 'New password', autoComplete: 'new-password' },
    { name: 'confirm', label: 'Repeat the new password', autoComplete: 'new-password' },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Change password</Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(event) =>
            void form.handleSubmit(({ oldPassword, newPassword }) =>
              change.mutate({ oldPassword, newPassword }, { onSuccess: () => onOpenChange(false) }),
            )(event)
          }
          noValidate
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>You stay logged in on this device.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {change.isError ? (
              <Alert variant="destructive" data-testid="change-password-error">
                <AlertDescription>{describeError(change.error)}</AlertDescription>
              </Alert>
            ) : null}
            {fields.map(({ name, label, autoComplete }) => (
              <Field key={name} data-invalid={!!form.formState.errors[name]}>
                <FieldLabel htmlFor={name}>{label}</FieldLabel>
                <Input
                  id={name}
                  type="password"
                  autoComplete={autoComplete}
                  aria-invalid={!!form.formState.errors[name]}
                  {...form.register(name)}
                />
                <FieldError errors={[form.formState.errors[name]]} />
              </Field>
            ))}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={change.isPending}>
              {change.isPending ? 'Saving...' : 'Change password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
