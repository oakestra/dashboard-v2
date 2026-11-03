import type { Application, Service } from '@oakestra/api';
import {
  applicationsQuery,
  profileQuery,
  servicesByApplicationQuery,
  useCurrentUser,
  useOakestraApi,
} from '@oakestra/dashboard-sdk';
import { useQueries, useQuery } from '@tanstack/react-query';

import { applicationHealth, type ApplicationHealth } from '../applications/health';
import { summarizeStatuses, type StatusSummary } from '../services/status';
import { attentionItems, type AttentionItem } from './attention';

export interface OverviewData {
  applications: readonly Application[];
  services: readonly Service[];
  instances: StatusSummary;
  attention: readonly AttentionItem[];
  /** Undefined for an application whose services are still loading. */
  healthById: ReadonlyMap<string, ApplicationHealth | undefined>;
  /** The profile or the application list is still loading. */
  applicationsLoading: boolean;
  /** Also some application's services are still loading. */
  servicesLoading: boolean;
  error: Error | null;
  retry: () => void;
}

/**
 * Data for all overview widgets of this package. Each widget calls it on its own; the queries are
 * the platform ones the application pages use, so together they cost one round of requests.
 */
export function useOverviewData(): OverviewData {
  const user = useCurrentUser();
  const api = useOakestraApi();

  // The overview is behind the login, so the user is always set; `enabled` only satisfies types.
  const profile = useQuery({
    ...profileQuery(api, user?.username ?? ''),
    enabled: user !== null,
  });
  const userId = profile.data?._id;
  const applications = useQuery({
    ...applicationsQuery(api, userId ?? ''),
    enabled: userId !== undefined,
  });
  // The API has no "all my services" endpoint for non-admins, so fetch per application.
  const serviceQueries = useQueries({
    queries: (applications.data ?? []).map((application) =>
      servicesByApplicationQuery(api, application._id),
    ),
  });

  const list = applications.data ?? [];
  const entries = list.map((application, index) => ({
    application,
    services: serviceQueries[index]?.data ?? [],
  }));
  const services = entries.flatMap((entry) => entry.services);
  const applicationsLoading = profile.isPending || applications.isPending;

  return {
    applications: list,
    services,
    instances: summarizeStatuses(
      services.flatMap((service) => service.instance_list.map((instance) => instance.status)),
    ),
    attention: attentionItems(entries),
    healthById: new Map(
      list.map((application, index) => {
        const data = serviceQueries[index]?.data;
        return [application._id, data ? applicationHealth(data) : undefined];
      }),
    ),
    applicationsLoading,
    servicesLoading: applicationsLoading || serviceQueries.some((query) => query.isPending),
    error: profile.error ?? applications.error,
    retry: () => void (profile.isError ? profile.refetch() : applications.refetch()),
  };
}
