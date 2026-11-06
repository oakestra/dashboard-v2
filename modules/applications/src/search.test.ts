import type { Application, Service } from '@oakestra/api';
import { createCommandContext } from '@oakestra/dashboard-sdk/testing';
import { describe, expect, it, vi } from 'vitest';

import { searchApplications } from './search';

const application = (id: string, name: string, userId = 'alice') =>
  ({
    _id: id,
    application_name: name,
    application_namespace: 'default',
    userId,
  }) as Application;

const service = (id: string, name: string, applicationID: string, status = 'RUNNING') =>
  ({
    _id: id,
    microservice_name: name,
    microservice_namespace: 'default',
    applicationID,
    status,
    instance_list: [],
  }) as unknown as Service;

const addon = { addonId: 'applications', basePath: '/applications' };

describe('searchApplications', () => {
  function asUser(applications: Application[], services: Service[]) {
    const listForApplication = vi.fn((id: string) =>
      Promise.resolve(services.filter((item) => item.applicationID === id)),
    );
    return {
      listForApplication,
      ctx: createCommandContext({
        addon,
        user: { username: 'alice', roles: ['Application_Provider'] },
        api: {
          users: { get: () => Promise.resolve({ _id: 'u1', name: 'alice' } as never) },
          applications: { listForUser: () => Promise.resolve(applications) },
          services: { listForApplication },
        },
      }),
    };
  }

  it('finds an application by name, with a link below the mount', async () => {
    const { ctx } = asUser([application('a1', 'webshop'), application('a2', 'mlbatch')], []);
    expect(await searchApplications('shop', ctx)).toMatchObject([
      {
        id: 'a1',
        label: 'webshop',
        description: 'Application in default',
        path: '/applications/a1',
      },
    ]);
  });

  it('finds a service and the application containing it', async () => {
    const { ctx } = asUser(
      [application('a1', 'mlbatch')],
      [service('s1', 'trainer', 'a1'), service('s2', 'loader', 'a1')],
    );
    expect(await searchApplications('train', ctx)).toMatchObject([
      {
        id: 's1',
        label: 'mlbatch / trainer',
        description: 'Service',
        path: '/applications/a1/services/s1',
      },
      {
        id: 'a1',
        label: 'mlbatch',
        description: 'Application containing trainer',
        path: '/applications/a1',
      },
    ]);
  });

  it('matches every word across application and service', async () => {
    const { ctx } = asUser(
      [application('a1', 'mlbatch')],
      [service('s1', 'trainer', 'a1'), service('s2', 'loader', 'a1')],
    );
    const results = await searchApplications('mlbatch load', ctx);
    expect(results.map((result) => result.id)).toEqual(['s2', 'a1']);
  });

  it('marks a service that cannot be placed', async () => {
    const { ctx } = asUser(
      [application('a1', 'mlbatch')],
      [service('s1', 'trainer', 'a1', 'NO_WORKER_CAPACITY')],
    );
    const [found, parent] = await searchApplications('trainer', ctx);
    expect(found).toMatchObject({ description: "Service, can't be placed", tone: 'warning' });
    expect(parent).toMatchObject({ tone: 'warning' });
  });

  it('still finds applications when the services of one failed to load', async () => {
    const { ctx, listForApplication } = asUser([application('a1', 'mlbatch')], []);
    listForApplication.mockRejectedValue(new Error('no'));
    const results = await searchApplications('ml', ctx);
    expect(results.map((result) => result.id)).toEqual(['a1']);
  });

  it('reads the services from the cache on the next search', async () => {
    const { ctx, listForApplication } = asUser([application('a1', 'mlbatch')], []);
    await searchApplications('ml', ctx);
    await searchApplications('mlb', ctx);
    expect(listForApplication).toHaveBeenCalledOnce();
  });

  it('leaves out what an Admin cannot open: detail pages belong to the owner', async () => {
    const ctx = createCommandContext({
      addon,
      user: { username: 'Admin', roles: ['Admin'] },
      api: {
        applications: {
          list: () =>
            Promise.resolve([
              application('a1', 'mine', 'Admin'),
              application('a2', 'theirs', 'alice'),
            ]),
        },
        services: {
          list: () => Promise.resolve([service('s1', 'web', 'a1'), service('s2', 'web', 'a2')]),
        },
      },
    });
    const results = await searchApplications('web', ctx);
    expect(results.map((result) => result.id)).toEqual(['s1', 'a1']);
    expect(await searchApplications('theirs', ctx)).toEqual([]);
  });

  it('is empty outside an addon context', async () => {
    const { ctx } = asUser([application('a1', 'mlbatch')], []);
    expect(await searchApplications('ml', { ...ctx, addon: undefined })).toEqual([]);
  });
});
