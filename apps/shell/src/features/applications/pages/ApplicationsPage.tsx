import type { Application } from '@oakestra/api';
import { useCurrentUser, useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  DropdownMenuItem,
  DropdownMenuSeparator,
  EmptyState,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { BoxesIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { describeError } from '../../../core/api/errors';
import { profileQuery } from '../../profile';
import { servicesByApplicationQuery } from '../../services';
import { applicationsQuery } from '../api/queries';
import { ApplicationFormDialog } from '../components/ApplicationFormDialog';
import { applicationHealth, describeServiceCounts } from '../health';
import { RowMenu } from '../components/RowMenu';
import { DeleteApplicationDialog } from '../components/DeleteApplicationDialog';

const column = createDataTableColumnHelper<Application>();

/**
 * Cells read the cached services themselves instead of getting them through the columns, so a
 * finished fetch or poll does not rebuild the columns (which would remount the row menus and
 * close an open one).
 */
function HealthCell({ application, part }: { application: Application; part: 'badge' | 'counts' }) {
  const api = useOakestraApi();
  const { data: health } = useQuery({
    ...servicesByApplicationQuery(api, application._id),
    select: applicationHealth,
  });
  if (part === 'badge') {
    return health ? (
      <StatusBadge tone={health.tone}>{health.label}</StatusBadge>
    ) : (
      <Skeleton className="h-5 w-20" />
    );
  }
  if (health) return <>{describeServiceCounts(health)}</>;
  const count = application.microservices.length;
  return <>{`${count} ${count === 1 ? 'service' : 'services'}`}</>;
}

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

  // Newest first (ObjectIds start with their creation time), so a new application is on top.
  const rows = useMemo(
    () => [...(applications.data ?? [])].sort((a, b) => b._id.localeCompare(a._id)),
    [applications.data],
  );

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('application_name', {
          header: 'Name',
          cell: ({ row }) => (
            <div className="min-w-0">
              <Link
                to={`/applications/${row.original._id}`}
                className="font-medium hover:underline"
              >
                {row.original.application_name}
              </Link>
              <div className="font-mono text-xs text-muted-foreground">
                {row.original.application_namespace}
              </div>
            </div>
          ),
        }),
        column.display({
          id: 'status',
          header: 'Status',
          cell: ({ row }) => <HealthCell application={row.original} part="badge" />,
        }),
        column.accessor('application_desc', {
          header: 'Description',
          meta: { className: 'hidden lg:table-cell', headerClassName: 'hidden lg:table-cell' },
          cell: (info) => (
            <span className="block max-w-xs truncate text-muted-foreground">
              {info.getValue() || '-'}
            </span>
          ),
        }),
        column.accessor((row) => row.microservices.length, {
          id: 'services',
          header: 'Services',
          meta: { numeric: true },
          cell: ({ row }) => <HealthCell application={row.original} part="counts" />,
        }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          meta: { align: 'right' },
          cell: ({ row }) => (
            <RowMenu label={`Actions for ${row.original.application_name}`}>
              <DropdownMenuItem onSelect={() => setEditing(row.original)}>
                <PencilIcon aria-hidden /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(row.original)}>
                <Trash2Icon aria-hidden /> Delete
              </DropdownMenuItem>
            </RowMenu>
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
          data={rows}
          isLoading={applications.isPending}
          getRowId={(row) => row._id}
          searchPlaceholder="Search applications"
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

      <ApplicationFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(created) => {
          if (created) void navigate(`/applications/${created._id}`);
        }}
      />
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
