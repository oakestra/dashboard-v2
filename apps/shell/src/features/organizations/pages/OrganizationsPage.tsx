import { ROOT_ORGANIZATION_NAME, type Organization } from '@oakestra/api';
import { useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader,
} from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { BuildingIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { describeError } from '../../../core/api/errors';
import { useDeleteOrganization } from '../api/mutations';
import { organizationsQuery } from '../api/queries';
import { CreateOrganizationDialog } from '../components/CreateOrganizationDialog';

const column = createDataTableColumnHelper<Organization>();

export function OrganizationsPage() {
  const api = useOakestraApi();
  const navigate = useNavigate();
  const organizations = useQuery(organizationsQuery(api));
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<Organization | null>(null);
  const remove = useDeleteOrganization();

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('name', { header: 'Name' }),
        column.accessor((organization) => organization.member.length, {
          id: 'members',
          header: 'Members',
        }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) => {
            const isRoot = row.original.name === ROOT_ORGANIZATION_NAME;
            return (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${row.original.name}`}
                  disabled={isRoot}
                  title={isRoot ? 'The root organization cannot be deleted' : undefined}
                  onClick={() => setDeleting(row.original)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </div>
            );
          },
        }),
      ]),
    [],
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
        <Alert variant="destructive">
          <AlertTitle>Could not load the organizations</AlertTitle>
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
      ) : (
        <DataTable
          label="Organizations"
          columns={columns}
          data={organizations.data}
          getRowId={(row) => row._id}
          isLoading={organizations.isPending}
          searchPlaceholder="Search organizations"
          onRowClick={(row) => void navigate(`/organizations/${row._id}`)}
          emptyState={
            <EmptyState
              icon={<BuildingIcon />}
              title="No organizations"
              description="Create one."
            />
          }
        />
      )}

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
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
