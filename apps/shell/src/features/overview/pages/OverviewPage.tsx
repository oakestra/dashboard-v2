import type { Application } from '@oakestra/api';
import { useCurrentUser, useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@oakestra/ui';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { describeError } from '../../../core/api/errors';
import { Slot } from '../../../core/extensions/Slot';
import { applicationsQuery } from '../../applications';
import { clustersQuery } from '../../infrastructure';
import { profileQuery } from '../../profile';
import { servicesByApplicationQuery } from '../../services';

const RECENT_APPLICATIONS = 5;

function StatCard({
  label,
  value,
  hint,
  loading,
  testId,
}: {
  label: string;
  value: number | string | undefined;
  hint?: string;
  loading: boolean;
  testId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums" data-testid={testId}>
          {loading ? <Skeleton className="h-8 w-16" /> : (value ?? '-')}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="text-xs text-muted-foreground">{loading ? '' : hint}</CardContent>
      ) : null}
    </Card>
  );
}

function RecentApplications({ applications }: { applications: readonly Application[] }) {
  if (applications.length === 0) {
    return (
      <EmptyState
        title="No applications yet"
        description="Create your first application to start deploying services."
        action={
          <Button asChild>
            <Link to="/applications">Go to applications</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul className="divide-y">
      {applications.map((application) => (
        <li key={application._id}>
          <Link
            to={`/applications/${application._id}`}
            className="flex items-center justify-between gap-4 py-3 hover:text-primary"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{application.application_name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {application.application_desc || application.application_namespace}
              </span>
            </span>
            <span className="shrink-0 text-sm text-muted-foreground">
              {application.microservices.length}{' '}
              {application.microservices.length === 1 ? 'service' : 'services'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function OverviewPage() {
  const user = useCurrentUser()!;
  const api = useOakestraApi();

  const profile = useQuery(profileQuery(api, user.username));
  const userId = profile.data?._id;
  const applications = useQuery({
    ...applicationsQuery(api, userId ?? ''),
    enabled: userId !== undefined,
  });
  const clusters = useQuery(clustersQuery(api));
  // The API has no "all my services" endpoint for non-admins, so fetch per application. The
  // queries are the ones the application pages use, so opening one afterwards is instant.
  const services = useQueries({
    queries: (applications.data ?? []).map((application) =>
      servicesByApplicationQuery(api, application._id),
    ),
  });

  const appsLoading = profile.isPending || applications.isPending;
  const servicesLoading = appsLoading || services.some((query) => query.isPending);
  const allServices = services.flatMap((query) => query.data ?? []);
  const instances = allServices.flatMap((service) => service.instance_list);
  const running = instances.filter((instance) => instance.status === 'RUNNING').length;
  const activeClusters = (clusters.data ?? []).filter((cluster) => cluster.active);
  const activeNodes = activeClusters.reduce((sum, cluster) => sum + (cluster.active_nodes ?? 0), 0);

  const error = profile.error ?? applications.error;
  const recent = [...(applications.data ?? [])]
    // Newest first: ObjectIds start with their creation time, so they sort chronologically.
    .sort((a, b) => b._id.localeCompare(a._id))
    .slice(0, RECENT_APPLICATIONS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.username}</h1>
        <p className="text-sm text-muted-foreground">What is running on your Oakestra platform.</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Could not load your applications: {describeError(error)}
          </AlertDescription>
        </Alert>
      ) : null}

      <section
        aria-label="Summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        data-testid="overview-summary"
      >
        <StatCard
          label="Applications"
          value={applications.data?.length}
          loading={appsLoading && !error}
          testId="stat-applications"
        />
        <StatCard
          label="Services"
          value={allServices.length}
          loading={servicesLoading && !error}
          testId="stat-services"
        />
        <StatCard
          label="Running instances"
          value={running}
          hint={`${instances.length} instances in total`}
          loading={servicesLoading && !error}
          testId="stat-instances"
        />
        <StatCard
          label="Clusters"
          value={clusters.isError ? undefined : activeClusters.length}
          hint={`${activeNodes} active ${activeNodes === 1 ? 'node' : 'nodes'}`}
          loading={clusters.isPending}
          testId="stat-clusters"
        />
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Recent applications</CardTitle>
            <CardDescription>Your newest applications.</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/applications">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {appsLoading && !error ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <RecentApplications applications={recent} />
          )}
        </CardContent>
      </Card>

      <section
        aria-label="Widgets"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        data-testid="home-widgets"
      >
        <Slot
          point="home.widgets"
          empty={<p className="text-sm text-muted-foreground">No widgets installed.</p>}
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
    </div>
  );
}
