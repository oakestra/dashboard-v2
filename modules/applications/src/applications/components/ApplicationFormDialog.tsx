import { zodResolver } from '@hookform/resolvers/zod';
import type { Application } from '@oakestra/api';
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
  Textarea,
} from '@oakestra/ui';
import { describeError } from '@oakestra/dashboard-sdk';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useCreateApplication, useUpdateApplication } from '../mutations';
import {
  applicationFormSchema,
  type ApplicationFormInput,
  type ApplicationFormValues,
} from '../schema';

const EMPTY: ApplicationFormInput = {
  application_name: '',
  application_namespace: 'default',
  application_desc: '',
};

interface ApplicationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edits this application; creates a new one when omitted. */
  application?: Application;
  /** Gets the created application when creating (undefined when the response did not include it). */
  onSaved?: (application?: Application) => void;
}

export function ApplicationFormDialog({
  open,
  onOpenChange,
  application,
  onSaved,
}: ApplicationFormDialogProps) {
  const create = useCreateApplication();
  const update = useUpdateApplication(application?._id ?? '');
  const mutation = application ? update : create;
  const form = useForm({ resolver: zodResolver(applicationFormSchema), defaultValues: EMPTY });

  // Re-seed on every open so a cancelled edit does not leak into the next one.
  const { reset } = form;
  const { reset: resetMutation } = mutation;
  useEffect(() => {
    if (!open) return;
    reset(
      application
        ? {
            application_name: application.application_name,
            application_namespace: application.application_namespace,
            application_desc: application.application_desc,
          }
        : EMPTY,
    );
    resetMutation();
  }, [open, application, reset, resetMutation]);

  const onValid = (values: ApplicationFormValues) => {
    if (application) {
      update.mutate(values, {
        onSuccess: () => {
          onOpenChange(false);
          onSaved?.();
        },
      });
    } else {
      create.mutate(values, {
        onSuccess: (created) => {
          onOpenChange(false);
          onSaved?.(created);
        },
      });
    }
  };

  const errors = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(event) => void form.handleSubmit(onValid)(event)}
          noValidate
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>{application ? 'Edit application' : 'New application'}</DialogTitle>
            <DialogDescription>
              An application groups services under a name and a namespace. Both take letters and
              digits, up to 32 characters.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            {mutation.isError ? (
              <Alert variant="destructive" data-testid="application-form-error">
                <AlertDescription>{describeError(mutation.error)}</AlertDescription>
              </Alert>
            ) : null}
            <Field data-invalid={!!errors.application_name}>
              <FieldLabel htmlFor="application_name">Name</FieldLabel>
              <Input
                id="application_name"
                autoComplete="off"
                aria-invalid={!!errors.application_name}
                {...form.register('application_name')}
              />
              <FieldError errors={[errors.application_name]} />
            </Field>
            <Field data-invalid={!!errors.application_namespace}>
              <FieldLabel htmlFor="application_namespace">Namespace</FieldLabel>
              <Input
                id="application_namespace"
                autoComplete="off"
                aria-invalid={!!errors.application_namespace}
                {...form.register('application_namespace')}
              />
              <FieldError errors={[errors.application_namespace]} />
            </Field>
            <Field data-invalid={!!errors.application_desc}>
              <FieldLabel htmlFor="application_desc">Description</FieldLabel>
              <Textarea
                id="application_desc"
                rows={3}
                aria-invalid={!!errors.application_desc}
                {...form.register('application_desc')}
              />
              <FieldError errors={[errors.application_desc]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : application ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
