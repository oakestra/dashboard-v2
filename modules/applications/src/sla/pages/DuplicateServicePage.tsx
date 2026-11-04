import { useOakestraApi } from '@oakestra/dashboard-sdk';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';

import { seededApplicationQuery, seededServiceQuery } from '../../queries';
import { isNotFound } from '../../components/NotFound';
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
  const queryClient = useQueryClient();
  const application = useQuery(seededApplicationQuery(api, queryClient, appId));
  const service = useQuery(seededServiceQuery(api, queryClient, serviceId));

  return (
    <PageFrame
      title={service.data ? `Duplicate ${service.data.microservice_name}` : 'Duplicate service'}
      description={
        application.data
          ? `Creates a copy in ${application.data.application_name}. Services cannot be edited yet, so change the copy and delete the original afterwards.`
          : 'Services cannot be edited yet, so change the copy and delete the original afterwards.'
      }
      queries={[application, service]}
      notFound={
        isNotFound(application.error)
          ? { title: 'Application not found', back: [], backLabel: 'All applications' }
          : { title: 'Service not found', back: [appId], backLabel: 'Back to the application' }
      }
    >
      {(customerId) =>
        application.data && service.data ? (
          // Keyed so navigating between two duplicates never reuses the previous form state.
          <ServiceForm
            key={service.data._id}
            application={application.data}
            customerId={customerId}
            initialValues={fromService(service.data)}
            source={{ id: service.data._id, name: service.data.microservice_name }}
          />
        ) : null
      }
    </PageFrame>
  );
}
