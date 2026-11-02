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
import type { UseMutationResult } from '@tanstack/react-query';
import { useId, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { describeError } from '../../../core/api/errors';

const schema = z.object({ name: z.string().trim().min(1, 'Enter a name') });

interface OrganizationNameDialogProps {
  title: string;
  description: ReactNode;
  initialName?: string;
  submitLabel: string;
  pendingLabel: string;
  /** Called with the trimmed name. */
  mutation: UseMutationResult<unknown, Error, string>;
  /** Runs after a successful save, before the dialog closes. */
  onDone?: () => void;
  onClose: () => void;
}

/**
 * Name form for creating and renaming organizations. Mount it only while open, so the field
 * always starts from `initialName`.
 */
export function OrganizationNameDialog({
  title,
  description,
  initialName = '',
  submitLabel,
  pendingLabel,
  mutation,
  onDone,
  onClose,
}: OrganizationNameDialogProps) {
  const inputId = useId();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { name: initialName } });

  // The mutation belongs to the page, so a failure would still show the next time it opens.
  const close = () => {
    mutation.reset();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => (!open && !mutation.isPending ? close() : undefined)}>
      <DialogContent>
        <form
          onSubmit={(event) =>
            void form.handleSubmit(({ name }) =>
              mutation.mutate(name.trim(), {
                onSuccess: () => {
                  onDone?.();
                  close();
                },
              }),
            )(event)
          }
          noValidate
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {mutation.isError ? (
              <Alert variant="destructive">
                <AlertDescription>{describeError(mutation.error)}</AlertDescription>
              </Alert>
            ) : null}
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor={inputId}>Name</FieldLabel>
              <Input
                id={inputId}
                autoComplete="off"
                aria-invalid={!!form.formState.errors.name}
                {...form.register('name')}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? pendingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
