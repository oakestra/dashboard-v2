import { ROOT_ORGANIZATION_NAME, type Organization, type OrganizationMember } from '@oakestra/api';
import {
  organizationsQuery,
  roleLabel,
  useAddonPath,
  useCurrentUser,
  useNotify,
  useOakestraApi,
  usersQuery,
} from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
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
  Skeleton,
  QueryErrorAlert,
  plural,
} from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import {
  BuildingIcon,
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  useDeleteOrganization,
  useRenameOrganization,
  useSetOrganizationMembers,
} from '../api/mutations';
import { MemberDialog } from '../components/MemberDialog';
import { OrganizationNameDialog } from '../components/OrganizationNameDialog';
import { RowMenu } from '../components/RowMenu';
import { initials } from '../initials';
import { adminCount, removalBlock, rolesBlock } from '../members';

interface MemberRow extends OrganizationMember {
  name: string | null;
}

const searchValue = (row: MemberRow) =>
  [row.name ?? row.user_id, ...row.roles.map(roleLabel)].join(' ');

const SORT_OPTIONS: readonly DataListSortOption<MemberRow>[] = [
  { id: 'name', label: 'Name', value: (row) => row.name ?? row.user_id },
];

function MemberItem({
  member,
  isSelf,
  menu,
}: {
  member: MemberRow;
  isSelf: boolean;
  menu: ReactNode;
}) {
  return (
    <Item className="rounded-none py-3">
      <ItemMedia>
        <Avatar aria-hidden>
          <AvatarFallback className="text-xs font-medium">
            {member.name === null ? '?' : initials(member.name)}
          </AvatarFallback>
        </Avatar>
      </ItemMedia>
      {member.name === null ? (
        <ItemContent>
          <ItemTitle className="text-muted-foreground">Deleted user</ItemTitle>
          <ItemDescription className="line-clamp-1 font-mono text-xs">
            {member.user_id}
          </ItemDescription>
        </ItemContent>
      ) : (
        <ItemContent>
          <ItemTitle>
            <span className="truncate">{member.name}</span>
            {isSelf ? <Badge variant="neutral">You</Badge> : null}
          </ItemTitle>
        </ItemContent>
      )}
      {/* Below `sm` the roles take a line of their own, lined up with the name. */}
      <div className="flex flex-wrap items-center gap-1 max-sm:order-last max-sm:basis-full max-sm:pl-12 sm:justify-end">
        {member.roles.length === 0 ? (
          <span className="text-muted-foreground text-sm">No roles</span>
        ) : (
          member.roles.map((role) => (
            <Badge key={role} variant="secondary">
              {roleLabel(role)}
            </Badge>
          ))
        )}
      </div>
      <ItemActions>{menu}</ItemActions>
    </Item>
  );
}

export function OrganizationDetailPage() {
  const { orgId = '' } = useParams();
  const api = useOakestraApi();
  const addonPath = useAddonPath();
  const organizations = useQuery(organizationsQuery(api));
  const users = useQuery(usersQuery(api));
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
      <QueryErrorAlert
        title="Could not load the organization"
        error={organizations.error}
        onRetry={() => void organizations.refetch()}
      />
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
            <Link to={addonPath()}>Back to organizations</Link>
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
  const rename = useRenameOrganization(organization);
  const me = useCurrentUser();
  const notify = useNotify();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [removing, setRemoving] = useState<MemberRow | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const addonPath = useAddonPath();
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

  const summary = `${plural(organization.member.length, 'member')}, ${plural(adminCount(organization), 'admin')}`;

  // Forms stay open after a failure so the input is not lost; the confirm dialog always closes.
  const send = (member: OrganizationMember[], done: () => void, closeOnFailure = false) =>
    setMembers.mutate(member, closeOnFailure ? { onSettled: done } : { onSuccess: done });
  const selfName = me?.username;
  const isSelf = (row: MemberRow) => row.name !== null && row.name === selfName;

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
          ) : undefined
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
      <p className="text-muted-foreground -mt-4 text-sm tabular-nums" data-testid="member-summary">
        {summary}
      </p>
      {usersFailed ? (
        <Alert variant="destructive">
          <AlertDescription>
            The user list could not be loaded, so members show as ids and none can be added.
          </AlertDescription>
        </Alert>
      ) : null}

      <DataList
        label="Members"
        noun="member"
        data={rows}
        getRowId={(row) => row.user_id}
        isLoading={usersLoading}
        searchValue={searchValue}
        sortOptions={SORT_OPTIONS}
        searchPlaceholder="Search members"
        renderItem={(row) => {
          const removeBlock = removalBlock(organization, row, isSelf(row));
          return (
            <MemberItem
              member={row}
              isSelf={isSelf(row)}
              menu={
                <RowMenu label={`Actions for ${row.name ?? row.user_id}`}>
                  <DropdownMenuItem onSelect={() => setEditing(row)}>
                    <PencilIcon aria-hidden />
                    Edit roles
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={removeBlock !== null}
                    title={removeBlock ?? undefined}
                    onSelect={() => setRemoving(row)}
                  >
                    <Trash2Icon aria-hidden />
                    Remove member
                  </DropdownMenuItem>
                </RowMenu>
              }
            />
          );
        }}
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
        <OrganizationNameDialog
          title="Rename organization"
          description="Members keep their roles. Users log in with the organization name, so tell them about the new one."
          initialName={organization.name}
          submitLabel="Rename"
          pendingLabel="Saving..."
          mutation={rename}
          onClose={() => setRenaming(false)}
        />
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
            send([...organization.member, { user_id: userId, roles }], () => setAdding(false));
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
                member.user_id === editing.user_id ? { user_id: member.user_id, roles } : member,
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
            onSuccess: () => void navigate(addonPath()),
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
            organization.member.filter((member) => member.user_id !== removing.user_id),
            () => setRemoving(null),
            true,
          );
        }}
      />
    </div>
  );
}
