import { ROOT_ORGANIZATION_NAME, type Organization } from '@oakestra/api';
import {
  organizationsQuery,
  useAddonPath,
  useOakestraApi,
  useSearchParam,
} from '@oakestra/dashboard-sdk';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DropdownMenuItem,
  EmptyState,
  PageHeader,
  QueryErrorAlert,
  plural,
  stretchedLinkClassName,
  RowMenu,
} from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { BuildingIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { useCreateOrganization, useDeleteOrganization } from '../api/mutations';
import { OrganizationNameDialog } from '../components/OrganizationNameDialog';
import { adminCount } from '../members';

const searchValue = (organization: Organization) => organization.name;

const SORT_OPTIONS: readonly DataListSortOption<Organization>[] = [
  { id: 'name', label: 'Name', value: (organization) => organization.name },
  {
    id: 'members',
    label: 'Most members',
    value: (organization) => organization.member.length,
    desc: true,
  },
];

function OrganizationCard({
  organization,
  href,
  menu,
}: {
  organization: Organization;
  href: string;
  menu: ReactNode;
}) {
  return (
    <Card className="hover:bg-accent/40 h-full gap-2 transition-colors">
      <div className="flex min-h-8 items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Link to={href} className={`block truncate font-semibold ${stretchedLinkClassName}`}>
            {organization.name}
          </Link>
          {organization.name === ROOT_ORGANIZATION_NAME ? (
            <Badge variant="neutral">Default</Badge>
          ) : null}
        </div>
        {menu ? <div className="relative z-10 -mr-2">{menu}</div> : null}
      </div>
      <p className="text-muted-foreground px-5 text-sm tabular-nums">
        {plural(organization.member.length, 'member')}, {plural(adminCount(organization), 'admin')}
      </p>
    </Card>
  );
}

export function OrganizationsPage() {
  const api = useOakestraApi();
  const addonPath = useAddonPath();
  const organizations = useQuery(organizationsQuery(api));
  const [search, setSearch] = useSearchParam('q');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<Organization | null>(null);
  const create = useCreateOrganization();
  const remove = useDeleteOrganization();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
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
        <DataList
          label="Organizations"
          noun="organization"
          layout="grid"
          data={organizations.data}
          getRowId={(row) => row._id}
          isLoading={organizations.isPending}
          searchValue={searchValue}
          sortOptions={SORT_OPTIONS}
          searchPlaceholder="Search organizations"
          globalFilter={search}
          onGlobalFilterChange={setSearch}
          renderItem={(organization) => (
            <OrganizationCard
              organization={organization}
              href={addonPath(organization._id)}
              menu={
                // The root organization cannot be deleted (the detail page explains why).
                organization.name === ROOT_ORGANIZATION_NAME ? null : (
                  <RowMenu label={`Actions for ${organization.name}`}>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeleting(organization)}
                    >
                      <Trash2Icon aria-hidden />
                      Delete organization
                    </DropdownMenuItem>
                  </RowMenu>
                )
              }
            />
          )}
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
