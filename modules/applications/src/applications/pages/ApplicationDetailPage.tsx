import {
  servicesByApplicationQuery,
  Slot,
  useAddonPath,
  useOakestraApi,
} from '@oakestra/dashboard-sdk';
import {
  Alert,
  Button,
  DropdownMenuItem,
  DropdownMenuSeparator,
  PageHeader,
  Skeleton,
  SourceTag,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  QueryErrorAlert,
  plural,
  RowMenu,
} from '@oakestra/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  InfoIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { isNotFound, NotFound } from '../../components/NotFound';
import { seededApplicationQuery } from '../../queries';
import { useDeployAll } from '../../services/mutations';
import { isUndeployed, usePollWhileTransitional } from '../../services/status';
import { applicationHealth, describeServiceCounts } from '../health';
import { ContributedTabContent } from '../../components/ContributedTabContent';
import { ApplicationTopology } from '../components/ApplicationTopology';
import { ServicesList } from '../components/ServicesList';
import { ApplicationFormDialog } from '../components/ApplicationFormDialog';
import { DeleteApplicationDialog } from '../components/DeleteApplicationDialog';

export function ApplicationDetailPage() {
  const { appId = '' } = useParams();
  const api = useOakestraApi();
  const navigate = useNavigate();
  const addonPath = useAddonPath();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // In the URL so a link can open the topology with a node selected.
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'services';
  // Stable on purpose: ContributedTabContent runs its cleanup whenever this changes, which would
  // look like the tab being removed.
  const setParamsRef = useRef(setParams);
  useLayoutEffect(() => {
    setParamsRef.current = setParams;
  });
  const changeTab = useCallback((value: string) => {
    setParamsRef.current(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === 'services') next.delete('tab');
        else next.set('tab', value);
        // The selected node only means something on the topology tab.
        next.delete('node');
        return next;
      },
      { replace: true },
    );
  }, []);
  const leaveTab = useCallback((value: string) => {
    setParamsRef.current(
      (previous) => {
        if (previous.get('tab') !== value) return previous;
        const next = new URLSearchParams(previous);
        next.delete('tab');
        return next;
      },
      { replace: true },
    );
  }, []);

  const application = useQuery(seededApplicationQuery(api, useQueryClient(), appId));
  const refetchInterval = usePollWhileTransitional();
  const services = useQuery({ ...servicesByApplicationQuery(api, appId), refetchInterval });
  const deployAll = useDeployAll();
  const tabContext = useMemo(() => ({ applicationId: appId }), [appId]);

  if (application.isPending) {
    return (
      <div className="space-y-4" data-testid="application-loading">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isNotFound(application.error)) {
    return (
      <NotFound
        title="Application not found"
        description="It may have been deleted."
        back={addonPath()}
        backLabel="All applications"
      />
    );
  }
  if (application.isError) {
    return (
      <QueryErrorAlert
        title="Could not load the application"
        error={application.error}
        onRetry={() => void application.refetch()}
      />
    );
  }

  const app = application.data;
  // The backend marks a service REQUESTED right away but only adds the instance once it is
  // scheduled, so an empty instance list alone would let a second click deploy it again.
  const undeployed = (services.data ?? []).filter(isUndeployed);

  const health = applicationHealth(services.data ?? []);
  const canDeploy = undeployed.length > 0 && !deployAll.isPending;
  const deployUndeployed = () => deployAll.mutate(undeployed.map((service) => service._id));

  // A service the scheduler already looked at (no capacity, failed) is not "not deployed": it was
  // tried and needs a retry, which is what deploying it again does.
  const stuck = undeployed.filter((service) => service.status !== undefined).length;
  const onlyStuck = undeployed.length > 0 && stuck === undeployed.length;
  const bannerText = onlyStuck
    ? `${plural(stuck, 'service')} could not be scheduled.`
    : stuck > 0
      ? `${plural(undeployed.length - stuck, 'service')} not deployed yet, ${stuck} could not be scheduled.`
      : `${plural(undeployed.length, 'service')} ${undeployed.length === 1 ? 'is' : 'are'} not deployed yet.`;

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
        <QueryErrorAlert
          title="Could not load the services"
          error={services.error}
          onRetry={() => void services.refetch()}
        />
      ) : (
        <ServicesList
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
              <Link to={addonPath(app._id, 'services', 'new')}>
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
            <RowMenu label="More actions" size="icon">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <PencilIcon aria-hidden /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <Trash2Icon aria-hidden /> Delete
              </DropdownMenuItem>
            </RowMenu>
          </>
        }
      />

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="topology">Topology</TabsTrigger>
          <Slot
            point="application.detail.tabs"
            context={tabContext}
            render={(extTab, _content, source) => (
              <TabsTrigger value={`${source.id}:${extTab.id}`}>
                {extTab.label}
                {source.remote ? (
                  <SourceTag name={source.displayName ?? source.id} version={source.version} />
                ) : null}
              </TabsTrigger>
            )}
          />
        </TabsList>
        <TabsContent value="services">{servicesPanel}</TabsContent>
        <TabsContent value="topology">
          <ApplicationTopology application={app} />
        </TabsContent>
        <Slot
          point="application.detail.tabs"
          context={tabContext}
          render={(extTab, content, source) => (
            <ContributedTabContent value={`${source.id}:${extTab.id}`} onRemoved={leaveTab}>
              {content}
            </ContributedTabContent>
          )}
        />
      </Tabs>

      <ApplicationFormDialog open={editing} onOpenChange={setEditing} application={app} />
      <DeleteApplicationDialog
        application={deleting ? app : null}
        onOpenChange={setDeleting}
        onDeleted={() => void navigate(addonPath(), { replace: true })}
      />
    </div>
  );
}
