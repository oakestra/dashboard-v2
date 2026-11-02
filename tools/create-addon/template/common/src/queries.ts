import { addonQueryKey, type OakestraApi } from '@oakestra/dashboard-sdk';
import { queryOptions } from '@tanstack/react-query';
import { ADDON_ID } from 'virtual:oakestra-addon';

// The shell and all addons share one QueryClient, so the addon id keeps the keys apart.
export const clustersQuery = (api: OakestraApi) =>
  queryOptions({
    queryKey: addonQueryKey(ADDON_ID, 'clusters'),
    queryFn: ({ signal }) => api.clusters.list({ signal }),
  });
