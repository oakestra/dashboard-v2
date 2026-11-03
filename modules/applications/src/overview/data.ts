import type { Application, Service } from '@oakestra/api';
import { servicesByApplicationQuery, useOakestraApi } from '@oakestra/dashboard-sdk';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';

import { applicationHealth, type ApplicationHealth } from '../applications/health';
import { summarizeStatuses, type StatusSummary } from '../services/status';
import { useMyApplications } from '../use-my-applications';
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

const NO_APPLICATIONS: readonly Application[] = [];

function summarize(list: readonly Application[], serviceQueries: UseQueryResult<Service[]>[]) {
  const entries = list.map((application, index) => ({
    application,
    services: serviceQueries[index]?.data ?? [],
  }));
  const services = entries.flatMap((entry) => entry.services);
  return {
    services,
    instances: summarizeStatuses(
      services.flatMap((service) => service.instance_list.map((instance) => instance.status)),
    ),
    attention: attentionItems(entries),
    healthById: new Map(
      list.map((application, index) => {
        const data = serviceQueries[index]?.data;
        return [application._id, data ? applicationHealth(data) : undefined] as const;
      }),
    ),
    servicesPending: serviceQueries.some((query) => query.isPending),
  };
}

/**
 * Data for all overview widgets of this package. Each widget calls it on its own; the queries are
 * the platform ones the application pages use, so together they cost one round of requests.
 */
export function useOverviewData(): OverviewData {
  const api = useOakestraApi();
  const { applications, isPending, error, retry } = useMyApplications();
  const list = applications.data ?? NO_APPLICATIONS;

  // `combine` reruns only when a services query or `list` changes, not on every render of each
  // widget, which matters once there are many applications with many instances.
  const combine = useCallback(
    (results: UseQueryResult<Service[]>[]) => summarize(list, results),
    [list],
  );
  // The API has no "all my services" endpoint for non-admins, so fetch per application.
  const { servicesPending, ...summary } = useQueries({
    queries: list.map((application) => servicesByApplicationQuery(api, application._id)),
    combine,
  });

  return {
    applications: list,
    ...summary,
    applicationsLoading: isPending,
    servicesLoading: isPending || servicesPending,
    error,
    retry,
  };
}
