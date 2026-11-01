import { useCurrentUser, useOakestraApi } from '@oakestra/dashboard-sdk';
import { Alert, AlertDescription } from '@oakestra/ui';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';

import { applicationQuery } from '../../applications';
import { serviceQuery } from '../../services';
import { PageFrame } from '../components/PageFrame';
import { ServiceForm } from '../components/ServiceForm';
import { fromService } from '../model/convert';

/**
 * Replaces editing: the backend answers `PUT /service/{id}` with 501, so a change means creating
 * a modified copy (and deleting the original afterwards).
 */
export function DuplicateServicePage() {
  const { appId = '', serviceId = '' } = useParams();
  const api = useOakestraApi();
  const customerId = useCurrentUser()?.organization ?? null;
  const application = useQuery(applicationQuery(api, appId));
  const service = useQuery(serviceQuery(api, serviceId));

  return (
    <PageFrame
      title="Duplicate service"
      description="The backend cannot edit services yet. Adjust this copy and create it, then remove the original if you no longer need it."
      queries={[application, service]}
    >
      {application.data && service.data && customerId ? (
        // Keyed so navigating between two duplicates never reuses the previous form state.
        <ServiceForm
          key={service.data._id}
          application={application.data}
          customerId={customerId}
          initialValues={fromService(service.data)}
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
