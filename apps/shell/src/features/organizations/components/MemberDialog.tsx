import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@oakestra/ui';
import { useState } from 'react';

import { RoleSelect } from '../../users';

export interface MemberCandidate {
  id: string;
  name: string;
}

interface MemberDialogProps {
  title: string;
  description?: string;
  submitLabel: string;
  /** Users that can still be added. Omit when editing an existing member. */
  candidates?: readonly MemberCandidate[];
  initialRoles?: readonly string[];
  pending: boolean;
  /** Returns a reason when the selected roles must not be saved; it is shown and blocks saving. */
  validateRoles?: (roles: string[]) => string | null;
  onSubmit: (value: { userId: string | null; roles: string[] }) => void;
  onClose: () => void;
}

/** Add-member and edit-roles in one: the user picker only exists when `candidates` is given. */
export function MemberDialog({
  title,
  description,
  submitLabel,
  candidates,
  initialRoles = [],
  pending,
  validateRoles,
  onSubmit,
  onClose,
}: MemberDialogProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([...initialRoles]);
  const needsUser = candidates !== undefined;
  const blocked = validateRoles?.(roles) ?? null;

  return (
    <Dialog open onOpenChange={(open) => (!open && !pending ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {needsUser ? (
          <Field>
            <FieldLabel htmlFor="member-user">User</FieldLabel>
            <Select value={userId ?? undefined} onValueChange={setUserId}>
              <SelectTrigger id="member-user" aria-label="User" className="w-full">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <RoleSelect value={roles} onChange={setRoles} disabled={pending} />
        {blocked ? (
          <p role="alert" className="text-destructive text-sm">
            {blocked}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={pending || blocked !== null || (needsUser && userId === null)}
            onClick={() => onSubmit({ userId, roles })}
          >
            {pending ? 'Saving...' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
