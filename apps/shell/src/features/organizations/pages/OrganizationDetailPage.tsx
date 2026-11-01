import { ROOT_ORGANIZATION_NAME, type Organization, type OrganizationMember } from '@oakestra/api';
import { useCurrentUser, useNotify, useOakestraApi } from '@oakestra/dashboard-sdk';
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
  DropdownMenuTrigger,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import {
  BuildingIcon,
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { describeError } from '../../../core/api/errors';
import { allUsersQuery, roleLabel } from '../../users';
import { useDeleteOrganization, useSetOrganizationMembers } from '../api/mutations';
import { organizationsQuery } from '../api/queries';
import { MemberDialog } from '../components/MemberDialog';
import { RenameOrganizationDialog } from '../components/RenameOrganizationDialog';
import { removalBlock, rolesBlock } from '../members';

interface MemberRow extends OrganizationMember {
  name: string | null;
}

const column = createDataTableColumnHelper<MemberRow>();

export function OrganizationDetailPage() {
  const { orgId = '' } = useParams();
  const api = useOakestraApi();
  const organizations = useQuery(organizationsQuery(api));
  const users = useQuery(allUsersQuery(api));
  const organization = organizations.data?.find((candidate) => candidate._id === orgId);

  if (organizations.isPending) {
    return (
      <div className="space-y-6" data-testid="organization-loading">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }
  if (organizations.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load the organization</AlertTitle>
        <AlertDescription>
          <p>{describeError(organizations.error)}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => void organizations.refetch()}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!organization) {
    return (
      <EmptyState
        icon={<BuildingIcon />}
        title="Organization not found"
        description="It may have been deleted."
        action={
          <Button asChild variant="outline">
            <Link to="/organizations">Back to organizations</Link>
          </Button>
        }
      />
    );
  }
  return (
    <Members
      organization={organization}
      users={users.data ?? []}
      usersFailed={users.isError}
      usersLoading={users.isPending}
    />
  );
}

interface MembersProps {
  organization: Organization;
  users: readonly { _id: string; name: string }[];
  usersFailed: boolean;
  usersLoading: boolean;
}

function Members({ organization, users, usersFailed, usersLoading }: MembersProps) {
  const setMembers = useSetOrganizationMembers(organization);
  const me = useCurrentUser();
  const notify = useNotify();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [removing, setRemoving] = useState<MemberRow | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const remove = useDeleteOrganization();
  const isRoot = organization.name === ROOT_ORGANIZATION_NAME;

  const rows = useMemo<MemberRow[]>(() => {
    const names = new Map(users.map((user) => [user._id, user.name]));
    return organization.member.map((member) => ({
      user_id: member.user_id,
      roles: member.roles,
      name: names.get(member.user_id) ?? null,
    }));
  }, [organization.member, users]);

  const candidates = useMemo(() => {
    const taken = new Set(organization.member.map((member) => member.user_id));
    return users.filter((user) => !taken.has(user._id)).map((u) => ({ id: u._id, name: u.name }));
  }, [organization.member, users]);

  const admins = organization.member.filter((member) => member.roles.includes('Admin')).length;
  const summary = `${organization.member.length === 1 ? '1 member' : `${organization.member.length} members`}, ${admins === 1 ? '1 admin' : `${admins} admins`}`;

  // The backend replaces the list, so every change sends all members; only user_id and roles of
  // each, in case the stored documents carry more.
  const plain = (member: OrganizationMember) => ({ user_id: member.user_id, roles: member.roles });
  // Forms stay open after a failure so the input is not lost; the confirm dialog always closes.
  const send = (member: OrganizationMember[], done: () => void, closeOnFailure = false) =>
    setMembers.mutate(member, closeOnFailure ? { onSettled: done } : { onSuccess: done });
  const selfName = me?.username;
  const isSelf = (row: MemberRow) => row.name !== null && row.name === selfName;

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor((row) => row.name ?? row.user_id, {
          id: 'name',
          header: 'User',
          cell: ({ row }) =>
            row.original.name === null ? (
              <span className="text-muted-foreground">
                Deleted user <span className="font-mono text-xs">{row.original.user_id}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="font-medium">{row.original.name}</span>
                {row.original.name === selfName ? <Badge variant="neutral">You</Badge> : null}
              </span>
            ),
        }),
        column.accessor((row) => row.roles.join(', '), {
          id: 'roles',
          header: 'Roles',
          enableSorting: false,
          cell: ({ row }) =>
            row.original.roles.length === 0 ? (
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
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          meta: { align: 'right' },
          cell: ({ row }) => {
            const label = row.original.name ?? row.original.user_id;
            const removeBlock = removalBlock(
              organization,
              row.original,
              row.original.name !== null && row.original.name === selfName,
            );
            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit roles of ${label}`}
                  onClick={() => setEditing(row.original)}
                >
                  <PencilIcon aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${label}`}
                  disabled={removeBlock !== null}
                  title={removeBlock ?? undefined}
                  onClick={() => setRemoving(row.original)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </div>
            );
          },
        }),
      ]),
    [organization, selfName],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={organization.name}
        description={
          isRoot ? (
            <span className="flex flex-wrap items-center gap-2">
              {/* Next to the title would put the badge inside the h1 and into its accessible name. */}
              <Badge variant="neutral">Default</Badge>
              Default organization for users who log in without one. It cannot be renamed or
              deleted.
            </span>
          ) : (
            'Members of this organization and their roles in it.'
          )
        }
        actions={
          <>
            <Button onClick={() => setAdding(true)} disabled={usersLoading || usersFailed}>
              <PlusIcon aria-hidden />
              Add member
            </Button>
            {isRoot ? null : (
              <Button variant="outline" onClick={() => setRenaming(true)}>
                <PencilIcon aria-hidden />
                Rename
              </Button>
            )}
            {isRoot ? null : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <EllipsisIcon aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                    <Trash2Icon aria-hidden />
                    Delete organization
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />
      <p className="text-muted-foreground -mt-3 text-sm tabular-nums" data-testid="member-summary">
        {summary}
      </p>
      {usersFailed ? (
        <Alert variant="destructive">
          <AlertDescription>
            The user list could not be loaded, so members show as ids and none can be added.
          </AlertDescription>
        </Alert>
      ) : null}

      <DataTable
        label="Members"
        columns={columns}
        data={rows}
        getRowId={(row) => row.user_id}
        isLoading={usersLoading}
        searchPlaceholder="Search members"
        emptyState={
          <EmptyState
            icon={<UsersIcon />}
            title="No members"
            description="Add users to give them roles in this organization."
            action={
              <Button onClick={() => setAdding(true)} disabled={usersLoading || usersFailed}>
                <PlusIcon aria-hidden />
                Add member
              </Button>
            }
          />
        }
      />

      {renaming ? (
        <RenameOrganizationDialog organization={organization} onClose={() => setRenaming(false)} />
      ) : null}
      {adding ? (
        <MemberDialog
          title="Add member"
          description={`Roles apply only inside ${organization.name}.`}
          submitLabel="Add member"
          candidates={candidates}
          pending={setMembers.isPending}
          onClose={() => setAdding(false)}
          onSubmit={({ userId, roles }) => {
            if (userId === null) return;
            send([...organization.member.map(plain), { user_id: userId, roles }], () =>
              setAdding(false),
            );
          }}
        />
      ) : null}
      {editing ? (
        <MemberDialog
          key={editing.user_id}
          title={`Edit roles of ${editing.name ?? editing.user_id}`}
          description={`Roles apply only inside ${organization.name}.`}
          submitLabel="Save roles"
          initialRoles={editing.roles}
          pending={setMembers.isPending}
          validateRoles={(roles) => rolesBlock(organization, editing, roles)}
          onClose={() => setEditing(null)}
          onSubmit={({ roles }) => {
            const blocked = rolesBlock(organization, editing, roles);
            if (blocked) {
              notify.error(blocked);
              return;
            }
            send(
              organization.member.map((member) =>
                member.user_id === editing.user_id
                  ? { user_id: member.user_id, roles }
                  : plain(member),
              ),
              () => setEditing(null),
            );
          }}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${organization.name}?`}
        description="Its members lose their roles in it. The user accounts stay. This cannot be undone."
        confirmLabel="Delete organization"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (isRoot) return;
          remove.mutate(organization, {
            onSuccess: () => void navigate('/organizations'),
            onSettled: () => setDeleting(false),
          });
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={`Remove ${removing?.name ?? 'member'}?`}
        description="The user loses their roles in this organization. The account stays."
        confirmLabel="Remove member"
        destructive
        pending={setMembers.isPending}
        onConfirm={() => {
          if (!removing) return;
          const blocked = removalBlock(organization, removing, isSelf(removing));
          if (blocked) {
            notify.error(blocked);
            setRemoving(null);
            return;
          }
          send(
            organization.member.filter((member) => member.user_id !== removing.user_id).map(plain),
            () => setRemoving(null),
            true,
          );
        }}
      />
    </div>
  );
}
