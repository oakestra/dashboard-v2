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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from '@oakestra/ui';
import { DicesIcon, DownloadIcon } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { describeError } from '../../../core/api/errors';
import { useCreateUser } from '../api/mutations';
import {
  downloadTextFile,
  formatCredentials,
  generatePassword,
  type Credentials,
} from '../credentials';
import { RoleSelect } from './RoleSelect';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a username'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
  roles: z.array(z.string()).min(1, 'Select at least one role'),
});

type FormValues = z.input<typeof schema>;
const EMPTY: FormValues = { name: '', email: '', password: '', roles: [] };

/** The old dashboard sent `dd/mm/yyyy hh:mm`; other tools parse that format, so keep it. */
function formatCreatedAt(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const create = useCreateUser();
  const [created, setCreated] = useState<Credentials | null>(null);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      form.reset(EMPTY);
      create.reset();
      setCreated(null);
    }
  };

  const onValid = (values: z.output<typeof schema>) => {
    create.mutate(
      { ...values, name: values.name.trim(), created_at: formatCreatedAt(new Date()) },
      {
        // The password is only known here; the credentials view is the one chance to hand it over.
        onSuccess: () =>
          setCreated({
            username: values.name.trim(),
            email: values.email,
            password: values.password,
            dashboardUrl: window.location.origin,
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {created ? (
          <div className="grid gap-4" data-testid="user-created">
            <DialogHeader>
              <DialogTitle>User created</DialogTitle>
              <DialogDescription>
                The password is not shown again. Download the credentials and hand them to the new
                user.
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Username</dt>
              <dd>{created.username}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{created.email}</dd>
              <dt className="text-muted-foreground">Password</dt>
              <dd className="font-mono">{created.password}</dd>
            </dl>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  downloadTextFile(`oakestra-${created.username}.txt`, formatCredentials(created))
                }
              >
                <DownloadIcon aria-hidden />
                Download credentials
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={(event) => void form.handleSubmit(onValid)(event)}
            noValidate
            className="grid gap-4"
          >
            <DialogHeader>
              <DialogTitle>Create user</DialogTitle>
              <DialogDescription>The user is added to your current organization.</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              {create.isError ? (
                <Alert variant="destructive" data-testid="create-user-error">
                  <AlertDescription>{describeError(create.error)}</AlertDescription>
                </Alert>
              ) : null}
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="new-user-name">Username</FieldLabel>
                <Input
                  id="new-user-name"
                  autoComplete="off"
                  aria-invalid={!!form.formState.errors.name}
                  {...form.register('name')}
                />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.email}>
                <FieldLabel htmlFor="new-user-email">Email address</FieldLabel>
                <Input
                  id="new-user-email"
                  type="email"
                  autoComplete="off"
                  aria-invalid={!!form.formState.errors.email}
                  {...form.register('email')}
                />
                <FieldError errors={[form.formState.errors.email]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.password}>
                <FieldLabel htmlFor="new-user-password">Password</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="new-user-password"
                    autoComplete="new-password"
                    className="font-mono"
                    aria-invalid={!!form.formState.errors.password}
                    {...form.register('password')}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      form.setValue('password', generatePassword(), { shouldValidate: true })
                    }
                  >
                    <DicesIcon aria-hidden />
                    Generate
                  </Button>
                </div>
                <FieldDescription>Shown in plain text so you can pass it on.</FieldDescription>
                <FieldError errors={[form.formState.errors.password]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.roles}>
                <FieldLabel>Roles</FieldLabel>
                <Controller
                  control={form.control}
                  name="roles"
                  render={({ field }) => (
                    <RoleSelect value={field.value} onChange={field.onChange} />
                  )}
                />
                <FieldError errors={[form.formState.errors.roles]} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating...' : 'Create user'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
