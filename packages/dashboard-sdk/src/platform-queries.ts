import { queryOptions } from '@tanstack/react-query';

import type { OakestraApi } from './types';

/**
 * Keys of the platform queries below. The shell uses the very same factories, so a package and
 * the shell share one cache entry (and one poll) instead of fetching the same data twice. They
 * are part of the SDK contract: changing a key is a breaking change, because packages built
 * against the old one would invalidate nothing.
 */
export const platformQueryKeys = {
  all: ['platform'] as const,
  clusters: () => [...platformQueryKeys.all, 'clusters'] as const,
  user: (username: string) => [...platformQueryKeys.all, 'user', username] as const,
  /**
   * Prefix of every user list: all users and the members of one organization. Organizations list
   * their members and users carry organization roles, so mutations on either side invalidate
   * this and `organizations()`.
   */
  users: () => [...platformQueryKeys.all, 'users'] as const,
  organizationUsers: (organizationId: string) =>
    [...platformQueryKeys.users(), 'organization', organizationId] as const,
  organizations: () => [...platformQueryKeys.all, 'organizations'] as const,
  /**
   * Prefix of every application query: the lists per user and the detail of one application.
   * Invalidating it refreshes both, which every change to an application (or to its service ids)
   * needs. The detail key lives here too, although only the applications package fetches it, so
   * the whole tree has one owner and nobody else builds keys under it.
   */
  applications: () => [...platformQueryKeys.all, 'applications'] as const,
  application: (applicationId: string) =>
    [...platformQueryKeys.applications(), 'detail', applicationId] as const,
  /** Prefix of every service query: the services of one application and single services. */
  services: () => [...platformQueryKeys.all, 'services'] as const,
  servicesByApplication: (applicationId: string) =>
    [...platformQueryKeys.services(), 'application', applicationId] as const,
  service: (serviceId: string) => [...platformQueryKeys.services(), 'detail', serviceId] as const,
};

/** Clusters report every few seconds; polling slower than that keeps pages fresh enough. */
export const CLUSTER_REFETCH_MS = 30_000;

/**
 * Every cluster (`GET /clusters/`, no token needed). There is no detail endpoint, so pages that
 * show one cluster use this query with a `select`.
 */
export function clustersQuery(api: OakestraApi) {
  return queryOptions({
    queryKey: platformQueryKeys.clusters(),
    queryFn: ({ signal }) => api.clusters.list({ signal }),
    refetchInterval: CLUSTER_REFETCH_MS,
  });
}

/**
 * The account of `username` (`GET /user/{name}`). The backend only answers it for the caller, so
 * pass `useCurrentUser().username`. It is the only source of the user's `_id`, which endpoints
 * like `api.applications.list(userId)` need.
 */
export function profileQuery(api: OakestraApi, username: string) {
  return queryOptions({
    queryKey: platformQueryKeys.user(username),
    queryFn: ({ signal }) => api.users.get(username, { signal }),
  });
}

/** Every user of the platform (`GET /users/`, Admin only). Entries carry no roles. */
export function usersQuery(api: OakestraApi) {
  return queryOptions({
    queryKey: [...platformQueryKeys.users(), 'list'] as const,
    queryFn: ({ signal }) => api.users.list({ signal }),
  });
}

/**
 * Every organization with its members (Admin only). There is no detail endpoint, so pages that
 * show one organization use this query with a `select`.
 */
export function organizationsQuery(api: OakestraApi) {
  return queryOptions({
    queryKey: [...platformQueryKeys.organizations(), 'list'] as const,
    queryFn: ({ signal }) => api.organizations.list({ signal }),
  });
}

/**
 * The applications of one user. `userId` is the user's `_id` (from `profileQuery`), not the
 * username: the backend answers a mismatch with 401.
 */
export function applicationsQuery(api: OakestraApi, userId: string) {
  return queryOptions({
    queryKey: [...platformQueryKeys.applications(), 'list', userId] as const,
    queryFn: ({ signal }) => api.applications.listForUser(userId, { signal }),
  });
}

/**
 * Every application of the platform (`GET /applications/`, Admin only). The entries have the shape
 * of the per-user lists, so `seedFromLists` over `platformQueryKeys.applications()` may seed from
 * this one too. Detail endpoints stay owner-scoped even for an Admin, see `Application.userId`.
 */
export function allApplicationsQuery(api: OakestraApi) {
  return queryOptions({
    queryKey: [...platformQueryKeys.applications(), 'all'] as const,
    queryFn: ({ signal }) => api.applications.list({ signal }),
  });
}

/**
 * The services of one application. There is no "all my services" endpoint for non-admins, so
 * pages that summarize several applications run one of these per application.
 */
export function servicesByApplicationQuery(api: OakestraApi, applicationId: string) {
  return queryOptions({
    queryKey: platformQueryKeys.servicesByApplication(applicationId),
    queryFn: ({ signal }) => api.services.listForApplication(applicationId, { signal }),
  });
}

/** Every service of the platform (`GET /services/`, Admin only), see `allApplicationsQuery`. */
export function allServicesQuery(api: OakestraApi) {
  return queryOptions({
    queryKey: [...platformQueryKeys.services(), 'all'] as const,
    queryFn: ({ signal }) => api.services.list({ signal }),
  });
}
