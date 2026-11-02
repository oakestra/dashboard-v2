import type { Application } from '@oakestra/api';
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

/**
 * Newest first: ObjectIds start with their creation time, so they sort chronologically. Not a
 * `select` on `applicationsQuery`, because the overview keeps the backend's order elsewhere.
 */
export function newestFirst(applications: readonly Application[]): Application[] {
  return [...applications].sort((a, b) => b._id.localeCompare(a._id));
}

export function applicationQuery(api: OakestraApi, applicationId: string) {
  return queryOptions({
    queryKey: applicationKeys.detail(applicationId),
    queryFn: ({ signal }) => api.applications.get(applicationId, { signal }),
  });
}
