import { useCurrentUser, useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { describeError } from '../../../core/api/errors';
import { useDeleteUser } from '../api/mutations';
import { allUsersQuery, organizationUsersQuery } from '../api/queries';
import { CreateUserDialog } from '../components/CreateUserDialog';
import { EditRolesDialog } from '../components/EditRolesDialog';
import { ROLE_OPTIONS, roleLabel } from '../roles';

interface UserRow {
  id: string;
  name: string;
  email: string;
  /** Undefined when the backend does not tell the roles of this user in the session's organization. */
  roles: readonly string[] | undefined;
  createdAt: string;
}

const ALL_ROLES = 'all';
const column = createDataTableColumnHelper<UserRow>();

export function UsersPage() {
  const api = useOakestraApi();
  const me = useCurrentUser()!;
  const organizationId = me.organization;

  // `/users/` lists everybody but has no roles; the organization listing has roles but only its
  // members. Both are needed so roles show wherever the backend knows them.
  const primary = useQuery(allUsersQuery(api));
  const members = useQuery({
    ...organizationUsersQuery(api, organizationId ?? ''),
    enabled: organizationId !== null,
  });
  // The role editor starts from the listed roles and saves the full set, so opening it before
  // they are known would overwrite them with just the new selection.
  const rolesKnown = members.isSuccess;

  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const roleFilter = params.get('role') ?? ALL_ROLES;
  const updateParam = (key: string, value: string, empty: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === empty) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const remove = useDeleteUser();

  const rows = useMemo<UserRow[]>(() => {
    const rolesById = new Map(members.data?.map((user) => [user._id, user.roles]));
    return (primary.data ?? []).map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      roles: rolesById.get(user._id),
      createdAt: user.created_at ?? '',
    }));
  }, [primary.data, members.data]);

  const filtered = useMemo(
    () => (roleFilter === ALL_ROLES ? rows : rows.filter((row) => row.roles?.includes(roleFilter))),
    [rows, roleFilter],
  );

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('name', { header: 'Name' }),
        column.accessor('email', { header: 'Email', cell: (info) => info.getValue() || '-' }),
        column.accessor((row) => row.roles?.join(', ') ?? '', {
          id: 'roles',
          header: 'Roles',
          enableSorting: false,
          cell: ({ row }) =>
            row.original.roles === undefined ? (
              <span className="text-muted-foreground" title="Roles are not known for this user">
                -
              </span>
            ) : row.original.roles.length === 0 ? (
              <span className="text-muted-foreground">No roles</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {row.original.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {roleLabel(role)}
                  </Badge>
                ))}
              </div>
            ),
        }),
        column.accessor('createdAt', { header: 'Created', cell: (info) => info.getValue() || '-' }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) => {
            const isSelf = row.original.name === me.username;
            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit roles of ${row.original.name}`}
                  disabled={!rolesKnown}
                  title={rolesKnown ? undefined : 'Roles are not loaded'}
                  onClick={() => setEditing(row.original)}
                >
                  <PencilIcon aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${row.original.name}`}
                  disabled={isSelf}
                  title={isSelf ? 'You cannot delete your own account' : undefined}
                  onClick={() => setDeleting(row.original)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </div>
            );
          },
        }),
      ]),
    [me.username, rolesKnown],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Accounts and roles in your organization."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon aria-hidden />
            Create user
          </Button>
        }
      />

      {members.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load the roles</AlertTitle>
          <AlertDescription>
            <p>{describeError(members.error)}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void members.refetch()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {primary.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load the users</AlertTitle>
          <AlertDescription>
            <p>{describeError(primary.error)}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void primary.refetch()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <DataTable
          label="Users"
          columns={columns}
          data={filtered}
          getRowId={(row) => row.id}
          isLoading={primary.isPending}
          searchPlaceholder="Search users"
          globalFilter={search}
          onGlobalFilterChange={(value) => updateParam('q', value, '')}
          emptyState={
            <EmptyState
              icon={<UsersIcon />}
              title="No users yet"
              description="Create the first account for your organization."
            />
          }
          toolbar={
            <Select
              value={roleFilter}
              onValueChange={(value) => updateParam('role', value, ALL_ROLES)}
            >
              <SelectTrigger aria-label="Filter by role" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ROLES}>All roles</SelectItem>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editing ? (
        <EditRolesDialog
          key={editing.id}
          username={editing.name}
          initialRoles={editing.roles ?? []}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`Delete ${deleting?.name ?? 'user'}?`}
        description="The account and its memberships are removed. This cannot be undone."
        confirmLabel="Delete user"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting && deleting.name !== me.username) {
            remove.mutate(deleting.name, { onSettled: () => setDeleting(null) });
          }
        }}
      />
    </div>
  );
}
