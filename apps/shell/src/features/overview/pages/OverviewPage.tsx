import { useCurrentUser, useOakestraApi, usePermissions } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  SectionCard,
  StatCard,
} from '@oakestra/ui';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ActivityIcon, BoxesIcon, BoxIcon, PlusIcon, ServerIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { describeError } from '../../../core/api/errors';
import { Slot } from '../../../core/extensions/Slot';
import { plural } from '../../../lib/format';
import {
  ApplicationFormDialog,
  applicationHealth,
  applicationsQuery,
  newestFirst,
  type ApplicationHealth,
} from '../../applications';
import { clusterTotals, clustersQuery, INFRASTRUCTURE_ROLES } from '../../infrastructure';
import { profileQuery } from '../../profile';
import { servicesByApplicationQuery, summarizeStatuses } from '../../services';
import { attentionItems } from '../attention';
import { GettingStarted } from '../components/GettingStarted';
import { NeedsAttention } from '../components/NeedsAttention';
import { RecentApplications, RecentApplicationsSkeleton } from '../components/RecentApplications';

const RECENT_APPLICATIONS = 5;

export function OverviewPage() {
  const user = useCurrentUser()!;
  const api = useOakestraApi();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [creating, setCreating] = useState(false);

  const profile = useQuery(profileQuery(api, user.username));
  const userId = profile.data?._id;
  const applications = useQuery({
    ...applicationsQuery(api, userId ?? ''),
    enabled: userId !== undefined,
  });
  const clusters = useQuery(clustersQuery(api));
  // The API has no "all my services" endpoint for non-admins, so fetch per application. The
  // queries are the ones the application pages use, so opening one afterwards is instant.
  const serviceQueries = useQueries({
    queries: (applications.data ?? []).map((application) =>
      servicesByApplicationQuery(api, application._id),
    ),
  });

  const appsLoading = profile.isPending || applications.isPending;
  const servicesLoading = appsLoading || serviceQueries.some((query) => query.isPending);
  const error = profile.error ?? applications.error;

  const entries = (applications.data ?? []).map((application, index) => ({
    application,
    services: serviceQueries[index]?.data ?? [],
  }));
  const allServices = entries.flatMap((entry) => entry.services);
  const instanceStatuses = allServices.flatMap((service) =>
    service.instance_list.map((instance) => instance.status),
  );
  const instances = summarizeStatuses(instanceStatuses);
  const attention = attentionItems(entries);
  const undeployed = attention.filter((item) => item.tone === 'neutral').length;
  const problems = attention.filter(
    (item) => item.tone === 'destructive' || item.tone === 'warning',
  );

  const healthById = new Map<string, ApplicationHealth | undefined>(
    entries.map(({ application }, index) => {
      const query = serviceQueries[index];
      return [application._id, query?.data ? applicationHealth(query.data) : undefined];
    }),
  );

  const clusterCounts = clusterTotals(clusters.data ?? []);
  const canSeeInfrastructure = permissions.hasAnyRole(INFRASTRUCTURE_ROLES);

  const recent = newestFirst(applications.data ?? []).slice(0, RECENT_APPLICATIONS);
  const hasApplications = (applications.data?.length ?? 0) > 0;
  const showGettingStarted = !appsLoading && !error && !hasApplications;

  const statsLoading = servicesLoading && !error;
  const instanceHint =
    instances.total === 0
      ? 'No instances yet'
      : instances.failed + instances.pending > 0
        ? [
            instances.pending > 0 ? `${instances.pending} pending` : null,
            instances.failed > 0 ? `${instances.failed} failed` : null,
          ]
            .filter(Boolean)
            .join(', ')
        : 'All running';

  const clusterTile = (
    <StatCard
      label="Clusters"
      value={clusters.isError ? '-' : `${clusterCounts.activeClusters}/${clusterCounts.clusters}`}
      icon={<ServerIcon />}
      tone={
        !clusters.isPending && !clusters.isError && clusterCounts.activeClusters === 0
          ? 'warning'
          : 'default'
      }
      hint={
        clusters.isError
          ? 'Could not load clusters'
          : `active, ${plural(clusterCounts.activeNodes, 'node')}`
      }
      loading={clusters.isPending}
      asChild={canSeeInfrastructure}
    >
      {canSeeInfrastructure ? <Link to="/infrastructure" /> : undefined}
    </StatCard>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={`Welcome back, ${user.username}.`}
        actions={
          hasApplications ? (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon aria-hidden /> New application
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Could not load your applications: {describeError(error)}
          </AlertDescription>
        </Alert>
      ) : null}

      <section
        aria-label="Summary"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        data-testid="overview-summary"
      >
        <StatCard
          asChild
          label="Applications"
          value={applications.data?.length ?? 0}
          icon={<BoxesIcon />}
          hint={plural(allServices.length, 'service')}
          loading={appsLoading && !error}
        >
          <Link to="/applications" />
        </StatCard>
        <StatCard
          asChild
          label="Services"
          value={allServices.length}
          icon={<BoxIcon />}
          tone={
            problems.some((item) => item.tone === 'destructive')
              ? 'destructive'
              : problems.length > 0
                ? 'warning'
                : 'default'
          }
          hint={
            problems.length > 0
              ? `${problems.length} need${problems.length === 1 ? 's' : ''} attention`
              : undeployed > 0
                ? `${undeployed} not deployed`
                : allServices.length === 0
                  ? 'No services yet'
                  : 'All deployed'
          }
          loading={statsLoading}
        >
          <Link to="/applications" />
        </StatCard>
        <StatCard
          asChild
          label="Instances"
          value={`${instances.running}/${instances.total}`}
          icon={<ActivityIcon />}
          tone={instances.failed > 0 ? 'destructive' : instances.pending > 0 ? 'info' : 'default'}
          hint={instanceHint}
          loading={statsLoading}
        >
          <Link to="/applications" />
        </StatCard>
        {clusterTile}
      </section>

      {showGettingStarted ? <GettingStarted onCreate={() => setCreating(true)} /> : null}

      {!error && hasApplications ? (
        <NeedsAttention
          items={attention}
          hasServices={allServices.length > 0}
          loading={servicesLoading}
        />
      ) : null}

      {showGettingStarted || error ? null : (
        <SectionCard
          title="Recent applications"
          description="Your newest applications and how they are doing."
          action={
            (applications.data?.length ?? 0) > RECENT_APPLICATIONS ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/applications">View all</Link>
              </Button>
            ) : undefined
          }
          flush
        >
          {appsLoading ? (
            <RecentApplicationsSkeleton />
          ) : (
            <RecentApplications applications={recent} healthById={healthById} />
          )}
        </SectionCard>
      )}

      {/* No empty state: end users cannot install widgets, and an empty grid collapses. */}
      <section
        aria-label="Widgets"
        className="grid gap-4 empty:hidden md:grid-cols-2 xl:grid-cols-3"
        data-testid="home-widgets"
      >
        <Slot
          point="home.widgets"
          render={(widget, content, source) => (
            <Card data-testid="home-widget" data-widget-id={`${source.id}:${widget.id}`}>
              <CardHeader>
                <CardTitle>{widget.title}</CardTitle>
              </CardHeader>
              <CardContent>{content}</CardContent>
            </Card>
          )}
        />
      </section>

      <ApplicationFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(created) => {
          if (created) void navigate(`/applications/${created._id}`);
        }}
      />
    </div>
  );
}
