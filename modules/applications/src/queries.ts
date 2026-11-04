import type { Application, Service } from '@oakestra/api';
import { platformQueryKeys, seedFromLists, type OakestraApi } from '@oakestra/dashboard-sdk';
import { matchQuery, queryOptions, type QueryClient, type QueryKey } from '@tanstack/react-query';

// Every key of this package sits under `platformQueryKeys.applications()` or `.services()`: the
// lists are SDK platform queries other packages and the shell may share, and invalidating one
// prefix also refreshes the details below it.

/**
 * Newest first: ObjectIds start with their creation time, so they sort chronologically. Not a
 * `select` on `applicationsQuery`: that query is shared (with the overview tiles, among others),
 * and callers that only count the applications need no sorted copy.
 */
export function newestFirst(applications: readonly Application[]): Application[] {
  return [...applications].sort((a, b) => b._id.localeCompare(a._id));
}

function applicationQuery(api: OakestraApi, applicationId: string) {
  return queryOptions({
    queryKey: platformQueryKeys.application(applicationId),
    queryFn: ({ signal }) => api.applications.get(applicationId, { signal }),
  });
}

/**
 * `applicationQuery` seeded from a cached list, so a page reached from the list renders at once.
 * Detail queries under the same prefix hold no arrays, so `seedFromLists` skips them.
 */
export function seededApplicationQuery(
  api: OakestraApi,
  queryClient: QueryClient,
  applicationId: string,
) {
  return queryOptions({
    ...applicationQuery(api, applicationId),
    ...seedFromLists<Application>(
      queryClient,
      platformQueryKeys.applications(),
      (application) => application._id === applicationId,
    ),
  });
}

function serviceQuery(api: OakestraApi, serviceId: string) {
  return queryOptions({
    queryKey: platformQueryKeys.service(serviceId),
    queryFn: ({ signal }) => api.services.get(serviceId, { signal }),
  });
}

/** `serviceQuery` seeded from the cached services of an application (see above). */
export function seededServiceQuery(api: OakestraApi, queryClient: QueryClient, serviceId: string) {
  return queryOptions({
    ...serviceQuery(api, serviceId),
    ...seedFromLists<Service>(
      queryClient,
      platformQueryKeys.services(),
      (service) => service._id === serviceId,
    ),
  });
}

// Lists hold models with an `_id`; details and anything else are left as they are.
function isModelList(data: unknown): data is readonly { _id?: unknown }[] {
  return Array.isArray(data);
}

/**
 * Cache update after deleting the entity with `_id` `id`.
 *
 * - Its own entries (`deleted`) are only marked stale: the page is still mounted until the caller
 *   navigates away, and a refetch would 404. Removing them does not help, mounted observers
 *   fetch a removed query again at once.
 * - It is dropped from every cached list under `refresh` first, otherwise the list the user
 *   returns to shows it until the refetch lands, and its row queries its services, which 404.
 * - Everything else under `refresh` is refetched as usual.
 */
export async function invalidateAfterDelete(
  queryClient: QueryClient,
  {
    id,
    deleted,
    refresh,
  }: { id: string; deleted: readonly QueryKey[]; refresh: readonly QueryKey[] },
): Promise<void> {
  const isDeleted = (query: Parameters<typeof matchQuery>[1]) =>
    deleted.some((queryKey) => matchQuery({ queryKey }, query));
  for (const queryKey of refresh) {
    queryClient.setQueriesData<unknown>(
      { queryKey, predicate: (query) => !isDeleted(query) },
      (data: unknown) => (isModelList(data) ? data.filter((item) => item._id !== id) : data),
    );
  }
  await Promise.all(
    deleted.map((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: 'none' })),
  );
  await Promise.all(
    refresh.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, predicate: (query) => !isDeleted(query) }),
    ),
  );
}
