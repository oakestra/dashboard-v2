import type { Service } from '@oakestra/api';
import {
  Button,
  ConfirmDialog,
  DropdownMenuItem,
  DropdownMenuSeparator,
  EmptyState,
} from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { CopyIcon, PlayIcon, ServerIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  formatVirtualization,
  StatusBadge,
  summarizeStatuses,
  useDeleteService,
  useDeployInstance,
} from '../../services';
import { RowMenu } from './RowMenu';

const column = createDataTableColumnHelper<Service>();

/** "2/2" running, with pending and failed counts only when there are any. */
function InstanceCount({ service }: { service: Service }) {
  const { total, running, pending, failed } = summarizeStatuses(
    service.instance_list.map((instance) => instance.status),
  );
  if (total === 0) return <span className="text-muted-foreground">None</span>;
  return (
    <span className="tabular-nums" data-testid="instance-count">
      {running}/{total}
      <span className="sr-only"> running</span>
      {pending > 0 ? <span className="ml-2 text-xs text-info">{pending} pending</span> : null}
      {failed > 0 ? <span className="ml-2 text-xs text-destructive">{failed} failed</span> : null}
    </span>
  );
}

interface ServicesTableProps {
  applicationId: string;
  /** Services in a different namespace than their application show it under the name. */
  applicationNamespace: string;
  services: readonly Service[] | undefined;
  isLoading: boolean;
}

export function ServicesTable({
  applicationId,
  applicationNamespace,
  services,
  isLoading,
}: ServicesTableProps) {
  const navigate = useNavigate();
  // `mutate` is stable, the mutation result object is not: depending on the latter would rebuild
  // the columns on every render and close an open row menu.
  const { mutate: deployInstance, isPending: deploying } = useDeployInstance();
  const remove = useDeleteService();
  const [deleting, setDeleting] = useState<Service | null>(null);

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('microservice_name', {
          header: 'Name',
          cell: ({ row }) => (
            <div className="min-w-0">
              <Link
                to={`/applications/${applicationId}/services/${row.original._id}`}
                className="font-medium hover:underline"
              >
                {row.original.microservice_name}
              </Link>
              {row.original.microservice_namespace !== applicationNamespace ? (
                <div className="text-xs text-muted-foreground">
                  {row.original.microservice_namespace}
                </div>
              ) : null}
            </div>
          ),
        }),
        column.accessor((row) => row.status ?? '', {
          id: 'status',
          header: 'Status',
          cell: ({ row }) => (
            <StatusBadge status={row.original.status} detail={row.original.status_detail} />
          ),
        }),
        column.accessor((row) => row.instance_list.length, {
          id: 'instances',
          header: 'Instances',
          cell: ({ row }) => <InstanceCount service={row.original} />,
        }),
        column.accessor((row) => row.image ?? row.code ?? '', {
          id: 'image',
          header: 'Image',
          cell: (info) => (
            <span className="block max-w-80 truncate font-mono text-xs" title={info.getValue()}>
              {info.getValue() || '-'}
            </span>
          ),
        }),
        column.accessor((row) => formatVirtualization(row.virtualization) ?? '', {
          id: 'virtualization',
          header: 'Virtualization',
          cell: (info) => info.getValue() || '-',
        }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          meta: { align: 'right' },
          cell: ({ row }) => {
            const service = row.original;
            return (
              <RowMenu label={`Actions for ${service.microservice_name}`}>
                <DropdownMenuItem disabled={deploying} onSelect={() => deployInstance(service._id)}>
                  <PlayIcon aria-hidden /> Deploy instance
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/applications/${applicationId}/services/${service._id}/duplicate`}>
                    <CopyIcon aria-hidden /> Duplicate
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(service)}>
                  <Trash2Icon aria-hidden /> Delete
                </DropdownMenuItem>
              </RowMenu>
            );
          },
        }),
      ]),
    [applicationId, applicationNamespace, deployInstance, deploying],
  );

  return (
    <>
      <DataTable
        label="Services"
        columns={columns}
        data={services}
        isLoading={isLoading}
        getRowId={(row) => row._id}
        searchPlaceholder="Search services"
        onRowClick={(row) => void navigate(`/applications/${applicationId}/services/${row._id}`)}
        emptyState={
          <EmptyState
            icon={<ServerIcon />}
            title="No services yet"
            description="Add a service to describe what this application runs."
            action={
              <Button asChild>
                <Link to={`/applications/${applicationId}/services/new`}>New service</Link>
              </Button>
            }
          />
        }
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.microservice_name ?? 'service'}?`}
        description="Its instances are stopped and removed. This cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting._id, { onSettled: () => setDeleting(null) });
        }}
      />
    </>
  );
}
