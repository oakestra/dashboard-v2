import { zodResolver } from '@hookform/resolvers/zod';
import type { Organization } from '@oakestra/api';
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
import { useRevalidator } from 'react-router';
import { z } from 'zod';

import { describeError } from '../../../core/api/errors';
import { useRenameOrganization } from '../api/mutations';

const schema = z.object({ name: z.string().trim().min(1, 'Enter a name') });

/** Mount it only while open, so the field always starts from the current name. */
export function RenameOrganizationDialog({
  organization,
  onClose,
}: {
  organization: Organization;
  onClose: () => void;
}) {
  const rename = useRenameOrganization(organization);
  const revalidator = useRevalidator();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: organization.name },
  });

  return (
    <Dialog open onOpenChange={(open) => (!open && !rename.isPending ? onClose() : undefined)}>
      <DialogContent>
        <form
          onSubmit={(event) =>
            void form.handleSubmit(({ name }) =>
              rename.mutate(name.trim(), {
                onSuccess: () => {
                  // The breadcrumb comes from the route loader, which only reruns on revalidation.
                  void revalidator.revalidate();
                  onClose();
                },
              }),
            )(event)
          }
          noValidate
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Rename organization</DialogTitle>
            <DialogDescription>
              Members keep their roles. Users log in with the organization name, so tell them about
              the new one.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {rename.isError ? (
              <Alert variant="destructive">
                <AlertDescription>{describeError(rename.error)}</AlertDescription>
              </Alert>
            ) : null}
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="rename-organization-name">Name</FieldLabel>
              <Input
                id="rename-organization-name"
                autoComplete="off"
                aria-invalid={!!form.formState.errors.name}
                {...form.register('name')}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={rename.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={rename.isPending}>
              {rename.isPending ? 'Saving...' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
