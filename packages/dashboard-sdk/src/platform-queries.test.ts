import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  applicationsQuery,
  clustersQuery,
  platformQueryKeys,
  profileQuery,
  servicesByApplicationQuery,
} from './platform-queries';
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
