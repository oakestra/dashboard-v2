import { addonQueryKey, type OakestraApi } from '@oakestra/dashboard-sdk';
import { queryOptions } from '@tanstack/react-query';
import { ADDON_ID } from 'virtual:oakestra-addon';

import { PROJECTS } from './data';

// The projects are fixtures: a real addon would call its own backend here. They still go through
// a query so pages and the palette share one cache entry, like they would with real data.
export const projectsQuery = () =>
  queryOptions({
    queryKey: addonQueryKey(ADDON_ID, 'projects'),
    queryFn: () => Promise.resolve(PROJECTS),
  });

export const applicationQuery = (api: OakestraApi, applicationId: string) =>
  queryOptions({
    queryKey: addonQueryKey(ADDON_ID, 'application', applicationId),
    queryFn: ({ signal }) => api.applications.get(applicationId, { signal }),
    retry: false,
  });
