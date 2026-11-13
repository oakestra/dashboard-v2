import { zodResolver } from '@hookform/resolvers/zod';
import { addTapInputSchema, type AddTapInput } from '@oakestra/api';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Label,
} from '@oakestra/ui';
import { Controller, useForm } from 'react-hook-form';

import { describeError } from '../../../core/api/errors';
import { useAddTap } from '../api/mutations';

const EMPTY: AddTapInput = {
  name: '',
  url: '',
  token: '',
  allow_insecure: false,
  allow_private: false,
};

interface AddTapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTapDialog({ open, onOpenChange }: AddTapDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open, so the token never outlives the dialog. */}
        <AddTapForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddTapForm({ onDone }: { onDone: () => void }) {
  const addTap = useAddTap();
  const form = useForm({ resolver: zodResolver(addTapInputSchema), defaultValues: EMPTY });
  const { errors } = form.formState;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a tap</DialogTitle>
        <DialogDescription>
          A tap is a third-party addon index. Its addons are listed as{' '}
          <code>&lt;tap&gt;/&lt;name&gt;</code> and synced periodically.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) =>
          void form.handleSubmit((values) =>
            addTap.mutate({ ...values, token: values.token || undefined }, { onSuccess: onDone }),
          )(event)
        }
      >
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="tap-name">Name</FieldLabel>
          <Input
            id="tap-name"
            placeholder="acme"
            autoComplete="off"
            aria-invalid={!!errors.name}
            {...form.register('name')}
          />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.url}>
          <FieldLabel htmlFor="tap-url">Index URL</FieldLabel>
          <Input
            id="tap-url"
            type="url"
            placeholder="https://addons.example.com/index.json"
            autoComplete="off"
            aria-invalid={!!errors.url}
            {...form.register('url')}
          />
          <FieldError errors={[errors.url]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="tap-token">Token (optional)</FieldLabel>
          <Input id="tap-token" type="password" autoComplete="off" {...form.register('token')} />
          <FieldDescription>
            Sent as a bearer token when the index is fetched. It is never shown again.
          </FieldDescription>
        </Field>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Controller
              control={form.control}
              name="allow_insecure"
              render={({ field }) => (
                <Checkbox
                  id="tap-allow-insecure"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <Label htmlFor="tap-allow-insecure" className="leading-snug font-normal">
              Allow plain http (the index and token travel unencrypted)
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <Controller
              control={form.control}
              name="allow_private"
              render={({ field }) => (
                <Checkbox
                  id="tap-allow-private"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <Label htmlFor="tap-allow-private" className="leading-snug font-normal">
              Allow private and loopback addresses (only for an index inside your network)
            </Label>
          </div>
        </div>

        {addTap.isError ? (
          <Alert variant="destructive" data-testid="add-tap-error">
            <AlertTitle>The marketplace refused the tap</AlertTitle>
            <AlertDescription>{describeError(addTap.error)}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={addTap.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={addTap.isPending}>
            {addTap.isPending ? 'Adding...' : 'Add tap'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
