import type { OakestraApi } from '@oakestra/dashboard-sdk';
import { queryOptions } from '@tanstack/react-query';

import { applicationKeys } from '../keys';

export { applicationKeys };

/** `userId` is the user's `_id` (see `profileQuery`), not the username. */
export function applicationsQuery(api: OakestraApi, userId: string) {
  return queryOptions({
    queryKey: applicationKeys.list(userId),
    queryFn: ({ signal }) => api.applications.listForUser(userId, { signal }),
  });
}

export function applicationQuery(api: OakestraApi, applicationId: string) {
  return queryOptions({
    queryKey: applicationKeys.detail(applicationId),
    queryFn: ({ signal }) => api.applications.get(applicationId, { signal }),
  });
}
