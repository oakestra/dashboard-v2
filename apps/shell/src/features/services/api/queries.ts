import type { OakestraApi } from '@oakestra/dashboard-sdk';
import { queryOptions } from '@tanstack/react-query';

import { serviceKeys } from '../keys';

export { serviceKeys };

export function servicesByApplicationQuery(api: OakestraApi, applicationId: string) {
  return queryOptions({
    queryKey: serviceKeys.byApplication(applicationId),
    queryFn: ({ signal }) => api.services.listForApplication(applicationId, { signal }),
  });
}

export function serviceQuery(api: OakestraApi, serviceId: string) {
  return queryOptions({
    queryKey: serviceKeys.detail(serviceId),
    queryFn: ({ signal }) => api.services.get(serviceId, { signal }),
  });
}
