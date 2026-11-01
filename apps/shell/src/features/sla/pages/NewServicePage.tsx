import { useCurrentUser, useOakestraApi } from '@oakestra/dashboard-sdk';
import { Alert, AlertDescription } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';

import { applicationQuery } from '../../applications';
import { PageFrame } from '../components/PageFrame';
import { ServiceForm } from '../components/ServiceForm';
import { defaultServiceValues } from '../model/schema';

export function NewServicePage() {
  const { appId = '' } = useParams();
  const api = useOakestraApi();
  const customerId = useCurrentUser()?.organization ?? null;
  const application = useQuery(applicationQuery(api, appId));

  return (
    <PageFrame
      title="New service"
      description="Describe the service. You can also import an SLA file."
      queries={[application]}
    >
      {application.data && customerId ? (
        <ServiceForm
          application={application.data}
          customerId={customerId}
          initialValues={defaultServiceValues()}
        />
      ) : (
        <Alert variant="destructive">
          <AlertDescription>
            Your session has no organization, so a service cannot be created.
          </AlertDescription>
        </Alert>
      )}
    </PageFrame>
  );
}
