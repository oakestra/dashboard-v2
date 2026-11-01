import { useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PageHeader,
  Skeleton,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import {
  InfoIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useRevalidator } from 'react-router';

import { describeError } from '../../../core/api/errors';
import { Slot } from '../../../core/extensions/Slot';
import { useContributions } from '../../../core/extensions/use-contributions';
import {
  isTransitionalStatus,
  servicesByApplicationQuery,
  useDeployAll,
  usePollWhileTransitional,
} from '../../services';
import { applicationQuery } from '../api/queries';
import { applicationHealth, describeServiceCounts } from '../health';
import { ServicesTable } from '../components/ServicesTable';
import { ApplicationFormDialog } from '../components/ApplicationFormDialog';
import { DeleteApplicationDialog } from '../components/DeleteApplicationDialog';

export function ApplicationDetailPage() {
  const { appId = '' } = useParams();
  const api = useOakestraApi();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const application = useQuery(applicationQuery(api, appId));
  const refetchInterval = usePollWhileTransitional();
  const services = useQuery({ ...servicesByApplicationQuery(api, appId), refetchInterval });
  const deployAll = useDeployAll();
  // Without contributed tabs a lone "Services" tab would only look like a stray button.
  const tabContext = useMemo(() => ({ applicationId: appId }), [appId]);
  const hasTabs = useContributions('application.detail.tabs', tabContext).length > 0;

  if (application.isPending) {
    return (
      <div className="space-y-4" data-testid="application-loading">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (application.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load the application</AlertTitle>
        <AlertDescription>
          <p>{describeError(application.error)}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => void application.refetch()}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const app = application.data;
  // The backend marks a service REQUESTED right away but only adds the instance once it is
  // scheduled, so an empty instance list alone would let a second click deploy it again.
  const undeployed = (services.data ?? []).filter(
    (service) => service.instance_list.length === 0 && !isTransitionalStatus(service.status),
  );

  const health = applicationHealth(services.data ?? []);
  const canDeploy = undeployed.length > 0 && !deployAll.isPending;
  const deployUndeployed = () => deployAll.mutate(undeployed.map((service) => service._id));

  // A service the scheduler already looked at (no capacity, failed) is not "not deployed": it was
  // tried and needs a retry, which is what deploying it again does.
  const stuck = undeployed.filter((service) => service.status !== undefined).length;
  const onlyStuck = undeployed.length > 0 && stuck === undeployed.length;
  const noun = (count: number) => `${count} ${count === 1 ? 'service' : 'services'}`;
  const bannerText = onlyStuck
    ? `${noun(stuck)} could not be scheduled.`
    : stuck > 0
      ? `${noun(undeployed.length - stuck)} not deployed yet, ${stuck} could not be scheduled.`
      : `${noun(undeployed.length)} ${undeployed.length === 1 ? 'is' : 'are'} not deployed yet.`;

  const servicesPanel = (
    <div className="space-y-3">
      {undeployed.length > 0 ? (
        // A standing hint, not an event: role=status keeps screen readers from interrupting.
        <Alert
          role="status"
          variant={stuck > 0 ? 'warning' : 'info'}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            {stuck > 0 ? (
              <TriangleAlertIcon aria-hidden className="size-4 shrink-0" />
            ) : (
              <InfoIcon aria-hidden className="size-4 shrink-0" />
            )}
            <span className="text-foreground">{bannerText}</span>
          </span>
          <Button size="sm" disabled={!canDeploy} onClick={deployUndeployed}>
            <PlayIcon aria-hidden />{' '}
            {onlyStuck ? 'Try again' : undeployed.length === 1 ? 'Deploy it' : 'Deploy them'}
          </Button>
        </Alert>
      ) : null}
      {services.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load the services</AlertTitle>
          <AlertDescription>
            <p>{describeError(services.error)}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void services.refetch()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <ServicesTable
          applicationId={app._id}
          applicationNamespace={app.application_namespace}
          services={services.data}
          isLoading={services.isPending}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={app.application_name}
        description={
          <>
            {app.application_desc ? <span className="block">{app.application_desc}</span> : null}
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-xs">{app.application_namespace}</span>
              {services.data ? (
                <>
                  <StatusBadge tone={health.tone}>{health.label}</StatusBadge>
                  <span className="tabular-nums">{describeServiceCounts(health)}</span>
                </>
              ) : null}
            </span>
          </>
        }
        actions={
          <>
            <Button asChild>
              <Link to={`/applications/${app._id}/services/new`}>
                <PlusIcon aria-hidden /> New service
              </Link>
            </Button>
            <Tooltip>
              {/* A disabled button swallows pointer events, so the span carries the tooltip. */}
              <TooltipTrigger asChild>
                <span tabIndex={canDeploy ? undefined : 0}>
                  <Button variant="outline" disabled={!canDeploy} onClick={deployUndeployed}>
                    <PlayIcon aria-hidden /> Deploy all
                  </Button>
                </span>
              </TooltipTrigger>
              {!canDeploy && !deployAll.isPending ? (
                <TooltipContent>Every service already has an instance</TooltipContent>
              ) : null}
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreHorizontalIcon aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <PencilIcon aria-hidden /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                  <Trash2Icon aria-hidden /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {hasTabs ? (
        <Tabs defaultValue="services">
          <TabsList>
            <TabsTrigger value="services">Services</TabsTrigger>
            <Slot
              point="application.detail.tabs"
              context={tabContext}
              render={(tab, _content, source) => {
                const value = `${source.id}:${tab.id}`;
                return <TabsTrigger value={value}>{tab.label}</TabsTrigger>;
              }}
            />
          </TabsList>
          <TabsContent value="services">{servicesPanel}</TabsContent>
          <Slot
            point="application.detail.tabs"
            context={tabContext}
            render={(tab, content, source) => (
              <TabsContent value={`${source.id}:${tab.id}`}>{content}</TabsContent>
            )}
          />
        </Tabs>
      ) : (
        <section aria-labelledby="services-heading" className="space-y-3">
          <h2 id="services-heading" className="text-base font-semibold">
            Services
          </h2>
          {servicesPanel}
        </section>
      )}

      <ApplicationFormDialog
        open={editing}
        onOpenChange={setEditing}
        application={app}
        // The breadcrumb comes from the route loader, which only reruns on revalidation.
        onSaved={() => void revalidator.revalidate()}
      />
      <DeleteApplicationDialog
        application={deleting ? app : null}
        onOpenChange={setDeleting}
        onDeleted={() => void navigate('/applications', { replace: true })}
      />
    </div>
  );
}
