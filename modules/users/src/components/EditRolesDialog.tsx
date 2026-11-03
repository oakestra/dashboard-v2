import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@oakestra/ui';
import { useState } from 'react';

import { useUpdateUserRoles } from '../api/mutations';
import { RoleSelect } from './RoleSelect';

interface EditRolesDialogProps {
  username: string;
  initialRoles: readonly string[];
  onClose: () => void;
}

/** Mount it per user (`key={username}`) so the selection starts from that user's roles. */
export function EditRolesDialog({ username, initialRoles, onClose }: EditRolesDialogProps) {
  const [roles, setRoles] = useState<string[]>([...initialRoles]);
  const update = useUpdateUserRoles();

  return (
    <Dialog open onOpenChange={(open) => (!open && !update.isPending ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit roles of {username}</DialogTitle>
          <DialogDescription>
            Roles apply to your current organization and take effect at the next login.
          </DialogDescription>
        </DialogHeader>
        <RoleSelect value={roles} onChange={setRoles} disabled={update.isPending} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            disabled={update.isPending}
            onClick={() => update.mutate({ username, roles }, { onSuccess: onClose })}
          >
            {update.isPending ? 'Saving...' : 'Save roles'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
