import type { Application } from '@oakestra/api';
import { useCurrentUser, useOakestraApi } from '@oakestra/dashboard-sdk';
import { Alert, AlertDescription, AlertTitle, Button, EmptyState, PageHeader } from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { BoxesIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { describeError } from '../../../core/api/errors';
import { profileQuery } from '../../profile';
import { applicationsQuery } from '../api/queries';
import { ApplicationFormDialog } from '../components/ApplicationFormDialog';
import { DeleteApplicationDialog } from '../components/DeleteApplicationDialog';

const column = createDataTableColumnHelper<Application>();

export function ApplicationsPage() {
  const user = useCurrentUser()!;
  const api = useOakestraApi();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const [deleting, setDeleting] = useState<Application | null>(null);

  const profile = useQuery(profileQuery(api, user.username));
  const userId = profile.data?._id;
  const applications = useQuery({
    ...applicationsQuery(api, userId ?? ''),
    enabled: userId !== undefined,
  });

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('application_name', {
          header: 'Name',
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
        column.accessor('application_namespace', { header: 'Namespace' }),
        column.accessor('application_desc', {
          header: 'Description',
          cell: (info) => (
            <span className="block max-w-xs truncate text-muted-foreground">
              {info.getValue() || '-'}
            </span>
          ),
        }),
        column.accessor((row) => row.microservices.length, {
          id: 'services',
          header: 'Services',
        }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) => (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${row.original.application_name}`}
                onClick={() => setEditing(row.original)}
              >
                <PencilIcon aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${row.original.application_name}`}
                onClick={() => setDeleting(row.original)}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </div>
          ),
        }),
      ]),
    [],
  );

  const error = profile.error ?? applications.error;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="Your applications and the services they group."
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon aria-hidden /> New application
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load your applications</AlertTitle>
          <AlertDescription>
            <p>{describeError(error)}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void (profile.isError ? profile.refetch() : applications.refetch())}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <DataTable
          label="Applications"
          columns={columns}
          data={applications.data}
          isLoading={applications.isPending}
          getRowId={(row) => row._id}
          searchPlaceholder="Search applications..."
          globalFilter={params.get('q') ?? ''}
          onGlobalFilterChange={(value) =>
            setParams(
              (previous) => {
                const next = new URLSearchParams(previous);
                if (value) next.set('q', value);
                else next.delete('q');
                return next;
              },
              { replace: true },
            )
          }
          onRowClick={(row) => void navigate(`/applications/${row._id}`)}
          emptyState={
            <EmptyState
              icon={<BoxesIcon />}
              title="No applications yet"
              description="Create an application, then add services to deploy."
              action={<Button onClick={() => setCreating(true)}>New application</Button>}
            />
          }
        />
      )}

      <ApplicationFormDialog open={creating} onOpenChange={setCreating} />
      <ApplicationFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        application={editing ?? undefined}
      />
      <DeleteApplicationDialog
        application={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  );
}
