import { useOakestraApi, type AddonCrumbProps } from '@oakestra/dashboard-sdk';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { seededApplicationQuery, seededServiceQuery } from './queries';

// The crumbs run the page's own query options, so crumb and page share one cache entry: a rename
// shows in both at once, and neither fetches twice.

export function ApplicationCrumb({ params }: AddonCrumbProps) {
  const application = useQuery(
    seededApplicationQuery(useOakestraApi(), useQueryClient(), params.appId ?? ''),
  );
  return application.data?.application_name ?? 'Application';
}

export function ServiceCrumb({ params }: AddonCrumbProps) {
  const service = useQuery(
    seededServiceQuery(useOakestraApi(), useQueryClient(), params.serviceId ?? ''),
  );
  return service.data?.microservice_name ?? 'Service';
}

export function InstanceCrumb({ params }: AddonCrumbProps) {
  return `Instance ${params.instanceNumber ?? ''}`.trim();
}
