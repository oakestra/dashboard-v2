import type { Service } from '@oakestra/api';
import { useAddonPath } from '@oakestra/dashboard-sdk';
import {
  Button,
  ConfirmDialog,
  DropdownMenuItem,
  DropdownMenuSeparator,
  EmptyState,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
  formatMegabytes,
  plural,
  stretchedLinkClassName,
  RowMenu,
} from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { CopyIcon, PlayIcon, ServerIcon, Trash2Icon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { StatusBadge } from '../../services/components/StatusBadge';
import { useDeleteService, useDeployInstance } from '../../services/mutations';
import { describeStatus, formatVirtualization, summarizeStatuses } from '../../services/status';

const searchValue = (service: Service) =>
  [
    service.microservice_name,
    service.microservice_namespace,
    describeStatus(service.status).label,
    service.image ?? service.code,
    formatVirtualization(service.virtualization),
  ].join(' ');

const SORT_OPTIONS: readonly DataListSortOption<Service>[] = [
  { id: 'name', label: 'Name', value: (service) => service.microservice_name },
  { id: 'status', label: 'Status', value: (service) => describeStatus(service.status).label },
  {
    id: 'instances',
    label: 'Most instances',
    value: (service) => service.instance_list.length,
    desc: true,
  },
];

/** "2/2 running", with pending and failed counts only when there are any. */
function InstanceCount({ service }: { service: Service }) {
  const { total, running, pending, failed } = summarizeStatuses(
    service.instance_list.map((instance) => instance.status),
  );
  if (total === 0) return <span className="text-sm text-muted-foreground">No instances</span>;
  return (
    <span className="text-sm tabular-nums" data-testid="instance-count">
      {running}/{total}
      <span className="text-muted-foreground"> running</span>
      {pending > 0 ? <span className="ml-2 text-xs text-info">{pending} pending</span> : null}
      {failed > 0 ? <span className="ml-2 text-xs text-destructive">{failed} failed</span> : null}
    </span>
  );
}

function describeResources(service: Service): string[] {
  return [
    formatVirtualization(service.virtualization),
    service.vcpus ? plural(service.vcpus, 'vCPU') : undefined,
    service.memory ? formatMegabytes(service.memory) : undefined,
  ].filter((text) => text !== undefined);
}

function ServiceItem({
  service,
  href,
  showNamespace,
  menu,
}: {
  service: Service;
  href: string;
  showNamespace: boolean;
  menu: ReactNode;
}) {
  const image = service.image ?? service.code;
  const resources = describeResources(service);
  return (
    <Item>
      <ItemContent className="basis-64">
        <ItemTitle>
          <Link to={href} className={`truncate ${stretchedLinkClassName}`}>
            {service.microservice_name}
          </Link>
          {/* Above the stretched link: the badge's title is the only place with the raw status. */}
          <span className="relative z-10 flex">
            <StatusBadge status={service.status} detail={service.status_detail} />
          </span>
        </ItemTitle>
        {showNamespace ? (
          <div className="truncate text-xs text-muted-foreground">
            {service.microservice_namespace}
          </div>
        ) : null}
        {image ? (
          <ItemDescription className="font-mono text-xs break-all">{image}</ItemDescription>
        ) : null}
        {resources.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
            {resources.map((text) => (
              <span key={text}>{text}</span>
            ))}
          </div>
        ) : null}
      </ItemContent>
      <InstanceCount service={service} />
      <ItemActions className="ml-auto">{menu}</ItemActions>
    </Item>
  );
}

interface ServicesListProps {
  applicationId: string;
  /** Services in a different namespace than their application show it under the name. */
  applicationNamespace: string;
  services: readonly Service[] | undefined;
  isLoading: boolean;
}

export function ServicesList({
  applicationId,
  applicationNamespace,
  services,
  isLoading,
}: ServicesListProps) {
  const addonPath = useAddonPath();
  const deploy = useDeployInstance();
  const remove = useDeleteService();
  const [deleting, setDeleting] = useState<Service | null>(null);

  return (
    <>
      <DataList
        label="Services"
        noun="service"
        data={services}
        isLoading={isLoading}
        getRowId={(row) => row._id}
        searchValue={searchValue}
        sortOptions={SORT_OPTIONS}
        searchPlaceholder="Search services"
        renderItem={(service) => (
          <ServiceItem
            service={service}
            href={addonPath(applicationId, 'services', service._id)}
            showNamespace={service.microservice_namespace !== applicationNamespace}
            menu={
              <RowMenu label={`Actions for ${service.microservice_name}`}>
                <DropdownMenuItem
                  disabled={deploy.isPending}
                  onSelect={() => deploy.mutate(service._id)}
                >
                  <PlayIcon aria-hidden /> Deploy instance
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={addonPath(applicationId, 'services', service._id, 'duplicate')}>
                    <CopyIcon aria-hidden /> Duplicate
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(service)}>
                  <Trash2Icon aria-hidden /> Delete
                </DropdownMenuItem>
              </RowMenu>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={<ServerIcon />}
            title="No services yet"
            description="Add a service to describe what this application runs."
            action={
              <Button asChild>
                <Link to={addonPath(applicationId, 'services', 'new')}>New service</Link>
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
