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
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from '@oakestra/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { describeError } from '../../../core/api/errors';
import { useCreateOrganization } from '../api/mutations';

const schema = z.object({ name: z.string().trim().min(1, 'Enter a name') });

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrganizationDialog({ open, onOpenChange }: CreateOrganizationDialogProps) {
  const create = useCreateOrganization();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { name: '' } });

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      form.reset();
      create.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form
          onSubmit={(event) =>
            void form.handleSubmit(({ name }) =>
              create.mutate(name.trim(), { onSuccess: () => handleOpenChange(false) }),
            )(event)
          }
          noValidate
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
            <DialogDescription>Members can be added once it exists.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {create.isError ? (
              <Alert variant="destructive">
                <AlertDescription>{describeError(create.error)}</AlertDescription>
              </Alert>
            ) : null}
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="organization-name">Name</FieldLabel>
              <Input
                id="organization-name"
                autoComplete="off"
                aria-invalid={!!form.formState.errors.name}
                {...form.register('name')}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating...' : 'Create organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
