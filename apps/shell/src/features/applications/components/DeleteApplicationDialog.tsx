import type { Application } from '@oakestra/api';
import { ConfirmDialog } from '@oakestra/ui';

import { plural } from '../../../lib/format';
import { useDeleteApplication } from '../api/mutations';

interface DeleteApplicationDialogProps {
  application: Application | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteApplicationDialog({
  application,
  onOpenChange,
  onDeleted,
}: DeleteApplicationDialogProps) {
  const remove = useDeleteApplication();
  const count = application?.microservices.length ?? 0;
  return (
    <ConfirmDialog
      open={application !== null}
      onOpenChange={onOpenChange}
      title={`Delete ${application?.application_name ?? 'application'}?`}
      description={
        count > 0
          ? `This also deletes its ${plural(count, 'service')} and stops all running instances. This cannot be undone.`
          : 'This cannot be undone.'
      }
      confirmLabel="Delete"
      destructive
      pending={remove.isPending}
      onConfirm={() => {
        if (!application) return;
        remove.mutate(application._id, {
          // The failure toast comes from the mutation; the dialog closes either way.
          onSuccess: () => onDeleted?.(),
          onSettled: () => onOpenChange(false),
        });
      }}
    />
  );
}
