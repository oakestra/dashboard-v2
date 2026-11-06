import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  allApplicationsQuery,
  allServicesQuery,
  applicationsQuery,
  clustersQuery,
  platformQueryKeys,
  profileQuery,
  servicesByApplicationQuery,
} from './platform-queries';
import { seedFromLists } from './seed-from-lists';
import { createMockApi } from './testing';

describe('platform queries', () => {
  it('keep their keys under one root, so the shell and packages share the cache', () => {
    const api = createMockApi();
    expect(clustersQuery(api).queryKey).toEqual(['platform', 'clusters']);
    expect(profileQuery(api, 'alice').queryKey).toEqual(['platform', 'user', 'alice']);
    expect(platformQueryKeys.user('alice').slice(0, 1)).toEqual(platformQueryKeys.all);
  });

  it('nest application and service lists and details under one prefix each', () => {
    const api = createMockApi();
    const applications = platformQueryKeys.applications();
    const services = platformQueryKeys.services();
    expect(applicationsQuery(api, 'u-1').queryKey.slice(0, 2)).toEqual(applications);
    expect(platformQueryKeys.application('a-1').slice(0, 2)).toEqual(applications);
    expect(servicesByApplicationQuery(api, 'a-1').queryKey.slice(0, 2)).toEqual(services);
    expect(platformQueryKeys.service('s-1').slice(0, 2)).toEqual(services);
    expect(applicationsQuery(api, 'u-1').queryKey).not.toEqual(
      platformQueryKeys.application('u-1'),
    );
  });

  it('keep the all-entities lists under the same prefixes, so existing invalidation covers them', async () => {
    const api = createMockApi();
    expect(allApplicationsQuery(api).queryKey.slice(0, 2)).toEqual(
      platformQueryKeys.applications(),
    );
    expect(allServicesQuery(api).queryKey.slice(0, 2)).toEqual(platformQueryKeys.services());

    const client = new QueryClient();
    client.setQueryData(allServicesQuery(api).queryKey, []);
    await client.invalidateQueries({ queryKey: platformQueryKeys.services() });
    expect(client.getQueryState(allServicesQuery(api).queryKey)?.isInvalidated).toBe(true);
  });

  it('let a detail page seed from the all-entities list like from any other list', () => {
    const api = createMockApi();
    const client = new QueryClient();
    client.setQueryData(allServicesQuery(api).queryKey, [{ _id: 's-1' }, { _id: 's-2' }] as never);
    client.setQueryData(platformQueryKeys.service('s-2'), { _id: 's-2' });

    const seed = seedFromLists<{ _id: string }>(
      client,
      platformQueryKeys.services(),
      (service) => service._id === 's-2',
    );
    expect(seed.initialData()).toEqual({ _id: 's-2' });
  });

  it('fetch through the API facade', async () => {
    const api = createMockApi({
      clusters: { list: () => Promise.resolve([]) },
      users: { get: (name: string) => Promise.resolve({ _id: 'u-1', name } as never) },
    });
    const client = new QueryClient();
    await expect(client.fetchQuery(clustersQuery(api))).resolves.toEqual([]);
    await expect(client.fetchQuery(profileQuery(api, 'alice'))).resolves.toMatchObject({
      _id: 'u-1',
    });
  });
});
