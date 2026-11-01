import type { OakestraApi } from '@oakestra/dashboard-sdk';
import { queryOptions } from '@tanstack/react-query';

import { userKeys } from '../keys';

export { userKeys };

/** Every user of the platform (Admin only). Entries carry no roles. */
export function allUsersQuery(api: OakestraApi) {
  return queryOptions({
    queryKey: userKeys.list(),
    queryFn: ({ signal }) => api.users.list({ signal }),
  });
}

/** Members of one organization with their roles in it. */
export function organizationUsersQuery(api: OakestraApi, organizationId: string) {
  return queryOptions({
    queryKey: userKeys.organization(organizationId),
    queryFn: ({ signal }) => api.users.listByOrganization(organizationId, { signal }),
  });
}
