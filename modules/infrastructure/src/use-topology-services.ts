import type { Service } from '@oakestra/api';
import {
  allApplicationsQuery,
  allServicesQuery,
  applicationsQuery,
  profileQuery,
  servicesByApplicationQuery,
  useCurrentUser,
  useOakestraApi,
  usePermissions,
} from '@oakestra/dashboard-sdk';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

const SILENT = { meta: { silent: true } };
// One empty array for all renders, so a pending or failed list doesn't rebuild the graph each time.
const NO_SERVICES: readonly Service[] = [];

// Kept out of the hook on purpose: TanStack reruns `combine` whenever it gets a new function.
function combineServices(results: UseQueryResult<Service[]>[]) {
  return {
    services: results.flatMap((result) => result.data ?? []),
    pending: results.some((result) => result.isPending),
    failed: results.some((result) => result.isError),
  };
}

/**
 * The services the viewer may see, for the workers in the topology. Same split as the fleet
 * (modules/fleet/src/use-fleet-data.ts): an Admin reads the platform-wide list, everyone else only
 * has endpoints for their own applications (the profile gives the `_id`, then one list per
 * application). An Infrastructure_Provider may have none of these, so failures are silent and
 * `failed` only tells the page to say the workers are missing; the cluster tree never depends on it.
 */
export function useTopologyServices(): {
  services: readonly Service[];
  /** Application names by id, so an instance can say whose it is. Missing ids are just unnamed. */
  applicationNames: ReadonlyMap<string, string>;
  pending: boolean;
  failed: boolean;
} {
  const api = useOakestraApi();
  const username = useCurrentUser()?.username ?? null;
  const isAdmin = usePermissions().hasRole('Admin');

  const allApplications = useQuery({
    ...allApplicationsQuery(api),
    ...SILENT,
    enabled: isAdmin,
  });
  const all = useQuery({ ...allServicesQuery(api), ...SILENT, enabled: isAdmin });
  const profile = useQuery({
    ...profileQuery(api, username ?? ''),
    ...SILENT,
    enabled: !isAdmin && username !== null,
  });
  const userId = profile.data?._id;
  const applications = useQuery({
    ...applicationsQuery(api, userId ?? ''),
    ...SILENT,
    enabled: !isAdmin && userId !== undefined,
  });
  const own = useQueries({
    queries: (applications.data ?? []).map((application) => ({
      ...servicesByApplicationQuery(api, application._id),
      ...SILENT,
    })),
    combine: combineServices,
  });

  const visibleApplications = isAdmin ? allApplications.data : applications.data;
  const applicationNames = useMemo(
    () =>
      new Map(
        (visibleApplications ?? []).map((application) => [
          application._id,
          application.application_name,
        ]),
      ),
    [visibleApplications],
  );

  if (isAdmin) {
    return {
      services: all.data ?? NO_SERVICES,
      applicationNames,
      pending: all.isPending,
      failed: all.isError,
    };
  }
  return {
    services: own.services,
    applicationNames,
    pending: profile.isPending || applications.isPending || own.pending,
    failed: profile.isError || applications.isError || own.failed,
  };
}
