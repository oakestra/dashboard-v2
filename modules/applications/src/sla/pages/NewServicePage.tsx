import { useOakestraApi } from '@oakestra/dashboard-sdk';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';

import { seededApplicationQuery } from '../../queries';
import { PageFrame } from '../components/PageFrame';
import { ServiceForm } from '../components/ServiceForm';
import { defaultServiceValues } from '../model/schema';

export function NewServicePage() {
  const { appId = '' } = useParams();
  const api = useOakestraApi();
  const application = useQuery(seededApplicationQuery(api, useQueryClient(), appId));

  return (
    <PageFrame
      title="New service"
      description="Describe the service. You can also import an SLA file."
      queries={[application]}
      notFound={{ title: 'Application not found', back: [], backLabel: 'All applications' }}
    >
      {(customerId) =>
        application.data ? (
          <ServiceForm
            application={application.data}
            customerId={customerId}
            initialValues={defaultServiceValues()}
          />
        ) : null
      }
    </PageFrame>
  );
}
