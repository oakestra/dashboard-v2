import type { Service } from '@oakestra/api';
import { Button, ConfirmDialog, EmptyState } from '@oakestra/ui';
import { createDataTableColumnHelper, DataTable } from '@oakestra/ui/data-table';
import { CopyIcon, PlayIcon, ServerIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { InstanceSummary, StatusBadge, useDeleteService, useDeployInstance } from '../../services';

const column = createDataTableColumnHelper<Service>();

interface ServicesTableProps {
  applicationId: string;
  services: readonly Service[] | undefined;
  isLoading: boolean;
}

export function ServicesTable({ applicationId, services, isLoading }: ServicesTableProps) {
  const navigate = useNavigate();
  const deploy = useDeployInstance();
  const remove = useDeleteService();
  const [deleting, setDeleting] = useState<Service | null>(null);

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor('microservice_name', {
          header: 'Name',
          cell: ({ row }) => (
            <div>
              <div className="font-medium">{row.original.microservice_name}</div>
              <div className="text-xs text-muted-foreground">
                {row.original.microservice_namespace}
              </div>
            </div>
          ),
        }),
        column.accessor((row) => row.image ?? row.code ?? '', {
          id: 'image',
          header: 'Image',
          cell: (info) => (
            <span className="block max-w-56 truncate font-mono text-xs">
              {info.getValue() || '-'}
            </span>
          ),
        }),
        column.accessor((row) => row.virtualization ?? '', {
          id: 'virtualization',
          header: 'Virtualization',
          cell: (info) => info.getValue() || '-',
        }),
        column.accessor((row) => row.instance_list.length, {
          id: 'instances',
          header: 'Instances',
          cell: ({ row }) => <InstanceSummary instances={row.original.instance_list} />,
        }),
        column.accessor((row) => row.status ?? '', {
          id: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusBadge status={row.original.status} />,
        }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) => {
            const service = row.original;
            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Deploy an instance of ${service.microservice_name}`}
                  title="Deploy an instance"
                  disabled={deploy.isPending}
                  onClick={() => deploy.mutate(service._id)}
                >
                  <PlayIcon aria-hidden />
                </Button>
                <Button variant="ghost" size="icon-sm" asChild title="Duplicate with changes">
                  <Link
                    aria-label={`Duplicate ${service.microservice_name}`}
                    to={`/applications/${applicationId}/services/${service._id}/duplicate`}
                  >
                    <CopyIcon aria-hidden />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${service.microservice_name}`}
                  title="Delete"
                  onClick={() => setDeleting(service)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </div>
            );
          },
        }),
      ]),
    [applicationId, deploy],
  );

  return (
    <>
      <DataTable
        label="Services"
        columns={columns}
        data={services}
        isLoading={isLoading}
        getRowId={(row) => row._id}
        searchPlaceholder="Search services..."
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
