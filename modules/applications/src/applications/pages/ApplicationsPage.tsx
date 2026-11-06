import type { Application } from '@oakestra/api';
import {
  servicesByApplicationQuery,
  useAddonPath,
  useOakestraApi,
  useSearchParam,
} from '@oakestra/dashboard-sdk';
import {
  Button,
  Card,
  DropdownMenuItem,
  DropdownMenuSeparator,
  EmptyState,
  PageHeader,
  Progress,
  Skeleton,
  StatusBadge,
  QueryErrorAlert,
  plural,
  stretchedLinkClassName,
} from '@oakestra/ui';
import { DataList, type DataListSortOption } from '@oakestra/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { BoxesIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { newestFirst } from '../../queries';
import { useMyApplications } from '../../use-my-applications';
import { ApplicationFormDialog } from '../components/ApplicationFormDialog';
import { applicationHealth, describeServiceCounts } from '../health';
import { RowMenu } from '../components/RowMenu';
import { DeleteApplicationDialog } from '../components/DeleteApplicationDialog';

const searchValue = (application: Application) =>
  [
    application.application_name,
    application.application_namespace,
    application.application_desc,
  ].join(' ');

const SORT_OPTIONS: readonly DataListSortOption<Application>[] = [
  { id: 'newest', label: 'Newest first', value: () => 0 },
  { id: 'name', label: 'Name', value: (application) => application.application_name },
  {
    id: 'services',
    label: 'Most services',
    value: (application) => application.microservices.length,
    desc: true,
  },
];

function ApplicationCard({
  application,
  href,
  menu,
}: {
  application: Application;
  href: string;
  menu: ReactNode;
}) {
  const api = useOakestraApi();
  const { data: health } = useQuery({
    ...servicesByApplicationQuery(api, application._id),
    select: applicationHealth,
  });
  const { running = 0, total = 0 } = health?.instances ?? {};
  return (
    <Card className="hover:bg-accent/40 h-full gap-3 transition-colors">
      <div className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <Link to={href} className={`block truncate font-semibold ${stretchedLinkClassName}`}>
            {application.application_name}
          </Link>
          <div className="text-muted-foreground truncate font-mono text-xs">
            {application.application_namespace}
          </div>
        </div>
        <div className="relative z-10 -mt-1 -mr-2">{menu}</div>
      </div>
      <p className="text-muted-foreground line-clamp-2 min-h-10 px-5 text-sm">
        {application.application_desc || 'No description'}
      </p>
      <div className="mt-auto space-y-2.5 px-5">
        <Progress
          aria-label={`Running instances of ${application.application_name}`}
          value={total > 0 ? (running / total) * 100 : 0}
          className="h-1"
        />
        <div className="flex items-center justify-between gap-3 text-sm">
          {health ? (
            <StatusBadge tone={health.tone}>{health.label}</StatusBadge>
          ) : (
            <Skeleton className="h-5 w-20" />
          )}
          <span className="text-muted-foreground truncate tabular-nums">
            {health
              ? describeServiceCounts(health)
              : plural(application.microservices.length, 'service')}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function ApplicationsPage() {
  const navigate = useNavigate();
  const addonPath = useAddonPath();
  const [search, setSearch] = useSearchParam('q');
  // In the URL so the command palette can link to it.
  const [newParam, setNewParam] = useSearchParam('new');
  const creating = newParam !== '';
  const setCreating = (open: boolean) => setNewParam(open ? '1' : '');
  const [editing, setEditing] = useState<Application | null>(null);
  const [deleting, setDeleting] = useState<Application | null>(null);

  const { applications, error, retry } = useMyApplications();

  // A new application is on top.
  const rows = useMemo(() => newestFirst(applications.data ?? []), [applications.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon aria-hidden /> New application
          </Button>
        }
      />

      {error ? (
        <QueryErrorAlert title="Could not load your applications" error={error} onRetry={retry} />
      ) : (
        <DataList
          label="Applications"
          noun="application"
          layout="grid"
          data={rows}
          isLoading={applications.isPending}
          getRowId={(row) => row._id}
          searchValue={searchValue}
          sortOptions={SORT_OPTIONS}
          searchPlaceholder="Search applications"
          globalFilter={search}
          onGlobalFilterChange={setSearch}
          renderItem={(application) => (
            <ApplicationCard
              application={application}
              href={addonPath(application._id)}
              menu={
                <RowMenu label={`Actions for ${application.application_name}`}>
                  <DropdownMenuItem onSelect={() => setEditing(application)}>
                    <PencilIcon aria-hidden /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(application)}>
                    <Trash2Icon aria-hidden /> Delete
                  </DropdownMenuItem>
                </RowMenu>
              }
            />
          )}
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
          if (created) void navigate(addonPath(created._id));
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
