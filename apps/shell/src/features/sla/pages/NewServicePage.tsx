import { useOakestraApi } from '@oakestra/dashboard-sdk';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';

import { applicationQuery } from '../../applications';
import { PageFrame } from '../components/PageFrame';
import { ServiceForm } from '../components/ServiceForm';
import { defaultServiceValues } from '../model/schema';

export function NewServicePage() {
  const { appId = '' } = useParams();
  const api = useOakestraApi();
  const application = useQuery(applicationQuery(api, appId));

  return (
    <PageFrame
      title="New service"
      description="Describe the service. You can also import an SLA file."
      queries={[application]}
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
