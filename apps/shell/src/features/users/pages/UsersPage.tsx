import { useCurrentUser, useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useIsMobile,
} from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { EllipsisIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { describeError } from '../../../core/api/errors';
import { formatDate, formatDateTime, parseLegacyDate } from '../../../lib/format';
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
  /** Raw backend string, shown as is when it cannot be parsed. */
  createdRaw: string;
  created: Date | undefined;
}

/** Compact rows show at most this many role badges; the rest is a "+N" with the names in a title. */
const COMPACT_ROLE_LIMIT = 2;

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

  const compact = useIsMobile();

  const rows = useMemo<UserRow[]>(() => {
    const rolesById = new Map(members.data?.map((user) => [user._id, user.roles]));
    return (primary.data ?? []).map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      roles: rolesById.get(user._id),
      createdRaw: user.created_at ?? '',
      created: parseLegacyDate(user.created_at),
    }));
  }, [primary.data, members.data]);

  const filtered = useMemo(
    () => (roleFilter === ALL_ROLES ? rows : rows.filter((row) => row.roles?.includes(roleFilter))),
    [rows, roleFilter],
  );

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('name', {
          header: 'Name',
          cell: ({ row }) => (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{row.original.name}</span>
                {row.original.name === me.username ? <Badge variant="neutral">You</Badge> : null}
              </div>
              {compact && row.original.email ? (
                <div className="text-muted-foreground truncate text-xs">{row.original.email}</div>
              ) : null}
            </div>
          ),
        }),
        ...(compact
          ? []
          : [
              column.accessor('email', {
                header: 'Email',
                cell: (info) => (
                  <span className="text-muted-foreground">{info.getValue() || '-'}</span>
                ),
              }),
            ]),
        column.accessor((row) => row.roles?.join(', ') ?? '', {
          id: 'roles',
          header: 'Roles',
          enableSorting: false,
          cell: ({ row }) => {
            const roles = row.original.roles;
            if (roles === undefined) {
              return (
                <span className="text-muted-foreground" title="Roles are not known for this user">
                  -
                </span>
              );
            }
            if (roles.length === 0) return <span className="text-muted-foreground">No roles</span>;
            const shown = compact ? roles.slice(0, COMPACT_ROLE_LIMIT) : roles;
            const hidden = roles.slice(shown.length);
            return (
              <div className="flex flex-wrap gap-1">
                {shown.map((role) => (
                  <Badge key={role} variant="secondary">
                    {roleLabel(role)}
                  </Badge>
                ))}
                {hidden.length > 0 ? (
                  <Badge variant="secondary" title={hidden.map(roleLabel).join(', ')}>
                    +{hidden.length}
                  </Badge>
                ) : null}
              </div>
            );
          },
        }),
        ...(compact
          ? []
          : [
              column.accessor((row) => row.created?.getTime() ?? 0, {
                id: 'created',
                header: 'Created',
                cell: ({ row }) =>
                  row.original.created ? (
                    <time
                      className="text-muted-foreground whitespace-nowrap"
                      dateTime={row.original.created.toISOString()}
                      title={formatDateTime(row.original.created)}
                    >
                      {formatDate(row.original.created)}
                    </time>
                  ) : (
                    <span className="text-muted-foreground">{row.original.createdRaw || '-'}</span>
                  ),
              }),
            ]),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          meta: { align: 'right' },
          cell: ({ row }) => {
            const isSelf = row.original.name === me.username;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Actions for ${row.original.name}`}
                  >
                    <EllipsisIcon aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!rolesKnown}
                    onSelect={() => setEditing(row.original)}
                  >
                    <PencilIcon aria-hidden />
                    Edit roles
                  </DropdownMenuItem>
                  {/* Hidden, not disabled: deleting yourself is never an option worth explaining. */}
                  {isSelf ? null : (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting(row.original)}
                      >
                        <Trash2Icon aria-hidden />
                        Delete user
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          },
        }),
      ]),
    [compact, me.username, rolesKnown],
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
            rows.length > 0 ? (
              <EmptyState
                icon={<UsersIcon />}
                title="No users with this role"
                description="Nobody in your organization has this role yet."
                action={
                  <Button
                    variant="outline"
                    onClick={() => updateParam('role', ALL_ROLES, ALL_ROLES)}
                  >
                    Clear filter
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<UsersIcon />}
                title="No users yet"
                description="Create the first account for your organization."
              />
            )
          }
          toolbar={
            <Select
              value={roleFilter}
              onValueChange={(value) => updateParam('role', value, ALL_ROLES)}
            >
              <SelectTrigger aria-label="Filter by role" className="w-full sm:w-52">
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
