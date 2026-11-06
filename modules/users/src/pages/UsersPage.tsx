import {
  ROLE_OPTIONS,
  roleLabel,
  useCurrentUser,
  useOakestraApi,
  useSearchParam,
  usersQuery,
} from '@oakestra/dashboard-sdk';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useIsMobile,
  QueryErrorAlert,
  formatDate,
  formatDateTime,
  parseLegacyDate,
} from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { EllipsisIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { useDeleteUser } from '../api/mutations';
import { organizationUsersQuery } from '../api/queries';
import { CreateUserDialog } from '../components/CreateUserDialog';
import { EditRolesDialog } from '../components/EditRolesDialog';
import { initials } from '../initials';

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

/** Compact items show at most this many role badges; the rest is a "+N" with the names in a title. */
const COMPACT_ROLE_LIMIT = 2;

const ALL_ROLES = 'all';

const searchValue = (row: UserRow) =>
  [row.name, row.email, ...(row.roles ?? []).map(roleLabel)].join(' ');

const createdTime = (row: UserRow) => row.created?.getTime() ?? 0;

const SORT_OPTIONS: readonly DataListSortOption<UserRow>[] = [
  { id: 'name', label: 'Name', value: (row) => row.name },
  { id: 'email', label: 'Email', value: (row) => row.email },
  { id: 'newest', label: 'Newest first', value: createdTime, desc: true },
  { id: 'oldest', label: 'Oldest first', value: createdTime },
];

function UserRoles({ roles, compact }: { roles: UserRow['roles']; compact: boolean }) {
  if (roles === undefined) {
    return <span className="text-muted-foreground text-sm">Roles unknown</span>;
  }
  if (roles.length === 0) return <span className="text-muted-foreground text-sm">No roles</span>;
  const shown = compact ? roles.slice(0, COMPACT_ROLE_LIMIT) : roles;
  const hidden = roles.slice(shown.length);
  return (
    <>
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
    </>
  );
}

function UserItem({
  user,
  isSelf,
  compact,
  menu,
}: {
  user: UserRow;
  isSelf: boolean;
  compact: boolean;
  menu: ReactNode;
}) {
  return (
    <Item className="rounded-none py-3">
      <ItemMedia>
        <Avatar aria-hidden>
          <AvatarFallback className="text-xs font-medium">{initials(user.name)}</AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <span className="truncate">{user.name}</span>
          {isSelf ? <Badge variant="neutral">You</Badge> : null}
        </ItemTitle>
        {user.email ? (
          <ItemDescription className="line-clamp-1">{user.email}</ItemDescription>
        ) : null}
      </ItemContent>
      {/* Below `sm` the roles take a line of their own, lined up with the name. */}
      <div className="flex flex-wrap items-center gap-1 max-sm:order-last max-sm:basis-full max-sm:pl-12 sm:justify-end">
        <UserRoles roles={user.roles} compact={compact} />
      </div>
      <div className="text-muted-foreground hidden w-24 text-right text-sm md:block">
        {user.created ? (
          <time dateTime={user.created.toISOString()} title={formatDateTime(user.created)}>
            {formatDate(user.created)}
          </time>
        ) : (
          user.createdRaw || '-'
        )}
      </div>
      <ItemActions>{menu}</ItemActions>
    </Item>
  );
}

export function UsersPage() {
  const api = useOakestraApi();
  const me = useCurrentUser()!;
  const organizationId = me.organization;

  // `/users/` lists everybody but has no roles; the organization listing has roles but only its
  // members. Both are needed so roles show wherever the backend knows them.
  const primary = useQuery(usersQuery(api));
  const members = useQuery({
    ...organizationUsersQuery(api, organizationId ?? ''),
    enabled: organizationId !== null,
  });
  // The role editor starts from the listed roles and saves the full set, so opening it before
  // they are known would overwrite them with just the new selection.
  const rolesKnown = members.isSuccess;

  const [search, setSearch] = useSearchParam('q');
  const [roleFilter, setRoleFilter] = useSearchParam('role', ALL_ROLES);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon aria-hidden />
            Create user
          </Button>
        }
      />

      {members.isError ? (
        <QueryErrorAlert
          title="Could not load the roles"
          error={members.error}
          onRetry={() => void members.refetch()}
        />
      ) : null}

      {primary.isError ? (
        <QueryErrorAlert
          title="Could not load the users"
          error={primary.error}
          onRetry={() => void primary.refetch()}
        />
      ) : (
        <DataList
          label="Users"
          noun="user"
          data={filtered}
          getRowId={(row) => row.id}
          isLoading={primary.isPending}
          searchValue={searchValue}
          sortOptions={SORT_OPTIONS}
          searchPlaceholder="Search users"
          globalFilter={search}
          onGlobalFilterChange={setSearch}
          renderItem={(row) => {
            const isSelf = row.name === me.username;
            return (
              <UserItem
                user={row}
                isSelf={isSelf}
                compact={compact}
                menu={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`}>
                        <EllipsisIcon aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled={!rolesKnown} onSelect={() => setEditing(row)}>
                        <PencilIcon aria-hidden />
                        Edit roles
                      </DropdownMenuItem>
                      {/* Hidden, not disabled: deleting yourself is never an option worth explaining. */}
                      {isSelf ? null : (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(row)}>
                            <Trash2Icon aria-hidden />
                            Delete user
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            );
          }}
          emptyState={
            rows.length > 0 ? (
              <EmptyState
                icon={<UsersIcon />}
                title="No users with this role"
                description="Nobody in your organization has this role yet."
                action={
                  <Button variant="outline" onClick={() => setRoleFilter(ALL_ROLES)}>
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
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value)}>
              <SelectTrigger aria-label="Filter by role" className="w-44 sm:w-52">
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
