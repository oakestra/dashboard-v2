import type { OakestraApi } from '@oakestra/dashboard-sdk';
import { queryOptions } from '@tanstack/react-query';

import { organizationKeys } from '../keys';

export { organizationKeys };

// The backend has no detail endpoint, so the detail page selects from this list.
export function organizationsQuery(api: OakestraApi) {
  return queryOptions({
    queryKey: organizationKeys.list(),
    queryFn: ({ signal }) => api.organizations.list({ signal }),
  });
}
