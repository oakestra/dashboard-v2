import { platformQueryKeys, type OakestraApi } from '@oakestra/dashboard-sdk';
import { queryOptions } from '@tanstack/react-query';

/**
 * Members of one organization with their roles in it. The key sits under the platform users
 * prefix, so the organizations package invalidates it without importing this one.
 */
export function organizationUsersQuery(api: OakestraApi, organizationId: string) {
  return queryOptions({
    queryKey: platformQueryKeys.organizationUsers(organizationId),
    queryFn: ({ signal }) => api.users.listByOrganization(organizationId, { signal }),
  });
}
