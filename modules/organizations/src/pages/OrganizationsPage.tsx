import { ROOT_ORGANIZATION_NAME, type Organization } from '@oakestra/api';
import { organizationsQuery, useAddonPath, useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  QueryErrorAlert,
} from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { BuildingIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useCreateOrganization, useDeleteOrganization } from '../api/mutations';
import { OrganizationNameDialog } from '../components/OrganizationNameDialog';

const column = createDataTableColumnHelper<Organization>();

export function OrganizationsPage() {
  const api = useOakestraApi();
  const navigate = useNavigate();
  const addonPath = useAddonPath();
  const organizations = useQuery(organizationsQuery(api));
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<Organization | null>(null);
  const create = useCreateOrganization();
  const remove = useDeleteOrganization();

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('name', {
          header: 'Name',
          // A real link keeps the row reachable by keyboard; the row click is the mouse shortcut.
          cell: ({ row }) => (
            <span className="flex items-center gap-2">
              <Link to={addonPath(row.original._id)} className="font-medium hover:underline">
                {row.original.name}
              </Link>
              {row.original.name === ROOT_ORGANIZATION_NAME ? (
                <Badge variant="neutral">Default</Badge>
              ) : null}
            </span>
          ),
        }),
        column.accessor((organization) => organization.member.length, {
          id: 'members',
          header: 'Members',
          meta: { numeric: true },
        }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          meta: { align: 'right' },
          // The root organization has no delete button at all: the detail page explains why.
          cell: ({ row }) =>
            row.original.name === ROOT_ORGANIZATION_NAME ? null : (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${row.original.name}`}
                onClick={() => setDeleting(row.original)}
              >
                <Trash2Icon aria-hidden />
              </Button>
            ),
        }),
      ]),
    [addonPath],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Groups of users that share a set of roles."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon aria-hidden />
            Create organization
          </Button>
        }
      />

      {organizations.isError ? (
        <QueryErrorAlert
          title="Could not load the organizations"
          error={organizations.error}
          onRetry={() => void organizations.refetch()}
        />
      ) : (
        <DataTable
          label="Organizations"
          columns={columns}
          data={organizations.data}
          getRowId={(row) => row._id}
          isLoading={organizations.isPending}
          searchPlaceholder="Search organizations"
          onRowClick={(row) => void navigate(addonPath(row._id))}
          emptyState={
            <EmptyState
              icon={<BuildingIcon />}
              title="No organizations yet"
              description="Organizations group users and give them roles."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <PlusIcon aria-hidden />
                  Create organization
                </Button>
              }
            />
          }
        />
      )}

      {createOpen ? (
        <OrganizationNameDialog
          title="Create organization"
          description="Members can be added once it exists."
          submitLabel="Create organization"
          pendingLabel="Creating..."
          mutation={create}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`Delete ${deleting?.name ?? 'organization'}?`}
        description="Its members lose their roles in it. The user accounts stay. This cannot be undone."
        confirmLabel="Delete organization"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting && deleting.name !== ROOT_ORGANIZATION_NAME) {
            remove.mutate(deleting, { onSettled: () => setDeleting(null) });
          }
        }}
      />
    </div>
  );
}
