import { useOakestraApi } from '@oakestra/dashboard-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  PageHeader,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { PencilIcon, PlayIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useRevalidator } from 'react-router';

import { describeError } from '../../../core/api/errors';
import { Slot } from '../../../core/extensions/Slot';
import {
  isTransitionalStatus,
  servicesByApplicationQuery,
  useDeployAll,
  usePollWhileTransitional,
} from '../../services';
import { applicationQuery } from '../api/queries';
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={app.application_name}
        description={app.application_desc || undefined}
        actions={
          <>
            <Button
              variant="outline"
              disabled={undeployed.length === 0 || deployAll.isPending}
              onClick={() => deployAll.mutate(undeployed.map((service) => service._id))}
            >
              <PlayIcon aria-hidden /> Deploy all
            </Button>
            <Button asChild>
              <Link to={`/applications/${app._id}/services/new`}>
                <PlusIcon aria-hidden /> New service
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <PencilIcon aria-hidden /> Edit
            </Button>
            <Button variant="outline" onClick={() => setDeleting(true)}>
              <Trash2Icon aria-hidden /> Delete
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">Namespace: {app.application_namespace}</Badge>
        <Badge variant="outline">
          {app.microservices.length} {app.microservices.length === 1 ? 'service' : 'services'}
        </Badge>
      </div>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <Slot
            point="application.detail.tabs"
            context={{ applicationId: app._id }}
            render={(tab, _content, source) => {
              const value = `${source.id}:${tab.id}`;
              return <TabsTrigger value={value}>{tab.label}</TabsTrigger>;
            }}
          />
        </TabsList>
        <TabsContent value="services" className="space-y-3">
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
              services={services.data}
              isLoading={services.isPending}
            />
          )}
        </TabsContent>
        <Slot
          point="application.detail.tabs"
          context={{ applicationId: app._id }}
          render={(tab, content, source) => (
            <TabsContent value={`${source.id}:${tab.id}`}>{content}</TabsContent>
          )}
        />
      </Tabs>

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
