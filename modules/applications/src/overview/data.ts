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

type ServiceLists = readonly (Service[] | undefined)[];

function computeSummary(list: readonly Application[], serviceLists: ServiceLists) {
  const entries = list.map((application, index) => ({
    application,
    services: serviceLists[index] ?? [],
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
        const data = serviceLists[index];
        return [application._id, data ? applicationHealth(data) : undefined] as const;
      }),
    ),
  };
}

let lastSummary:
  | {
      list: readonly Application[];
      serviceLists: ServiceLists;
      summary: ReturnType<typeof computeSummary>;
    }
  | undefined;

/**
 * Each widget calls useOverviewData on its own, so without this every finished query would walk
 * all services five times. The widgets get the same data references, so one result does for all.
 */
function summarize(list: readonly Application[], serviceLists: ServiceLists) {
  const last = lastSummary;
  if (
    last?.list === list &&
    last.serviceLists.length === serviceLists.length &&
    last.serviceLists.every((services, index) => services === serviceLists[index])
  ) {
    return last.summary;
  }
  const summary = computeSummary(list, serviceLists);
  lastSummary = { list, serviceLists, summary };
  return summary;
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
    (results: UseQueryResult<Service[]>[]) => ({
      ...summarize(
        list,
        results.map((query) => query.data),
      ),
      servicesPending: results.some((query) => query.isPending),
    }),
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
