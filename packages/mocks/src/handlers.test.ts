import {
  ApiError,
  createOakestraApi,
  createOakestraClient,
  type OakestraEndpoints,
  type SlaV2,
} from '@oakestra/api';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { LEAKED_PASSWORD_PLACEHOLDER } from './handlers.ts';
import { createMockServer } from './node.ts';
import { createMockSession } from './session.ts';

const baseUrl = 'http://mock.test/api';
const { server, store } = createMockServer({ baseUrl });

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => store.reset());
afterAll(() => server.close());

/** The @oakestra/api facade with a fixed bearer token, i.e. without the shell's refresh logic. */
function apiAs(options: Parameters<typeof createMockSession>[1] = {}): OakestraEndpoints {
  const { accessToken } = createMockSession(store, options);
  return createOakestraApi(
    createOakestraClient({
      baseUrl,
      fetch: (request) => {
        if (!request.headers.has('Authorization')) {
          request.headers.set('Authorization', `Bearer ${accessToken}`);
        }
        return fetch(request);
      },
    }),
  );
}

const anonymous = () => createOakestraApi(createOakestraClient({ baseUrl }));

function sla(app: { applicationID?: string; name: string }, services: string[] = []): SlaV2 {
  return {
    sla_version: 'v2.0',
    customerID: 'customer',
    applications: [
      {
        applicationID: app.applicationID,
        application_name: app.name,
        application_namespace: 'test',
        application_desc: 'created by a test',
        microservices: services.map((name) => ({
          microservice_name: name,
          microservice_namespace: 'test',
          virtualization: 'container',
          code: 'docker.io/library/nginx:alpine',
        })),
      },
    ],
  };
}

async function expectApiError(promise: Promise<unknown>, status: number, message?: string) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(status);
  if (message) expect((error as ApiError).message).toBe(message);
}

describe('auth', () => {
  it('logs in, refreshes and reports bad credentials like the backend', async () => {
    const api = anonymous();
    const tokens = await api.auth.login({ username: 'Admin', password: 'Admin' });
    expect(await api.auth.refresh(tokens.refresh_token)).toEqual(expect.any(String));

    await expectApiError(api.auth.login({ username: 'Admin', password: 'nope' }), 401);
    await expectApiError(
      api.auth.login({ username: 'Admin', password: 'Admin', organization_name: 'nope' }),
      404,
    );
    // An access token is not a refresh token.
    await expectApiError(api.auth.refresh(tokens.token), 422, 'Only refresh tokens are allowed');
  });

  it('completes a password reset with the emailed token', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const api = anonymous();
    await api.auth.requestPasswordReset({ username: 'alice', domain: 'localhost' });
    const [entry] = store.data.resetTokens;
    await api.auth.resetPassword({ token: entry!.token, password: 'new-password' });
    await expect(
      api.auth.login({ username: 'alice', password: 'new-password' }),
    ).resolves.toBeTruthy();
    await expectApiError(api.auth.resetPassword({ token: entry!.token, password: 'x' }), 400);
  });

  it('rejects requests without or with expired tokens', async () => {
    await expectApiError(anonymous().users.get('Admin'), 401, 'Missing Authorization Header');
    const expired = apiAs({ accessTokenTtlSeconds: -1 });
    await expectApiError(expired.users.get('Admin'), 401, 'Token has expired');
  });
});

describe('users', () => {
  it('never lets the password hash through the models', async () => {
    const api = apiAs();
    const raw = await fetch(`${baseUrl}/users/`, {
      headers: { Authorization: `Bearer ${createMockSession(store).accessToken}` },
    }).then((response) => response.text());
    expect(raw).toContain(LEAKED_PASSWORD_PLACEHOLDER);

    const users = await api.users.list();
    expect(JSON.stringify(users)).not.toContain(LEAKED_PASSWORD_PLACEHOLDER);
    expect(JSON.stringify(await api.users.get('Admin'))).not.toContain('password');
  });

  it('covers the user endpoints with the backend permission rules', async () => {
    const admin = apiAs();
    const created = await admin.users.create({
      name: 'erin',
      email: 'erin@example.com',
      password: 'erin',
      roles: ['Application_Provider'],
      created_at: '01/11/2026 10:00',
    });
    expect(created.roles).toEqual(['Application_Provider']);
    await expectApiError(
      admin.users.create({ ...created, password: 'x', roles: [], created_at: '' }),
      409,
    );

    await admin.users.update('erin', {
      email: 'erin@new.example',
      roles: ['Infrastructure_Provider'],
    });
    const root = store.data.organizations.find((org) => org.name === 'root')!;
    const members = await admin.users.listByOrganization(root._id);
    expect(members.find((user) => user.name === 'erin')).toMatchObject({
      email: 'erin@new.example',
      roles: ['Infrastructure_Provider'],
    });

    const erin = apiAs({ username: 'erin' });
    expect(await erin.users.getRoles('erin')).toEqual(['Infrastructure_Provider']);
    await expectApiError(erin.users.get('Admin'), 403, 'You have not enough permissions!');
    await expectApiError(erin.users.update('erin', { email: 'x' }), 403);
    await expectApiError(
      erin.users.changePassword('erin', { oldPassword: 'wrong', newPassword: 'x' }),
      400,
      'Old password is not valid!',
    );
    await erin.users.changePassword('erin', { oldPassword: 'erin', newPassword: 'better' });

    await admin.users.delete('erin');
    expect((await admin.users.list()).map((user) => user.name)).not.toContain('erin');
  });
});

describe('applications, services and instances', () => {
  it('runs the whole lifecycle', async () => {
    const api = apiAs();
    const adminId = store.data.users.find((user) => user.name === 'Admin')!._id;

    const apps = await api.applications.create(sla({ name: 'demo' }));
    const demo = apps.find((app) => app.application_name === 'demo')!;
    expect(await api.applications.listForUser(adminId)).toContainEqual(demo);
    await expectApiError(api.applications.create(sla({ name: 'demo' })), 409);

    await api.applications.update(demo._id, { application_desc: 'changed' });
    expect((await api.applications.get(demo._id)).application_desc).toBe('changed');

    const created = await api.services.create(
      sla({ applicationID: demo._id, name: 'demo' }, ['web']),
    );
    const serviceId = created.job_id!;
    expect((await api.services.listForApplication(demo._id)).map((s) => s._id)).toEqual([
      serviceId,
    ]);
    await expectApiError(api.services.update(serviceId, sla({ name: 'demo' })), 501);

    await api.instances.deploy(serviceId);
    await api.instances.deploy(serviceId);
    await api.instances.undeploy(serviceId, 0);
    const service = await api.services.get(serviceId);
    expect(service.instance_list.map((instance) => instance.instance_number)).toEqual([1]);
    expect(service.instance_list[0]?.cpu_percent).toBe(0);

    await api.services.delete(serviceId);
    await api.applications.delete(demo._id);
    await expectApiError(api.applications.get(demo._id), 404);
  });

  describe('POST /service/ outcome shape', () => {
    const appId = () => store.data.applications[0]!._id;
    const withIp = (name: string, rrIp: string) => ({
      microservice_name: name,
      microservice_namespace: 'test',
      virtualization: 'container',
      code: 'nginx',
      addresses: { rr_ip: rrIp },
    });
    const body = (microservices: Record<string, unknown>[]) => {
      const document = sla({ applicationID: appId(), name: 'x' });
      document.applications[0]!.microservices = microservices as never;
      return document;
    };

    it('answers 200 with named deployed_services and the failures of a partial refusal', async () => {
      const api = apiAs();
      const result = await api.services.create(
        body([withIp('first', '10.30.9.9'), withIp('second', '10.30.9.9')]),
      );

      expect(result.deployed_services).toEqual([{ service_name: 'first', status: 200 }]);
      expect(result.failed_services).toEqual([
        {
          service_name: 'second',
          message: expect.stringContaining('10.30.9.9'),
          status: 500,
        },
      ]);
      expect(store.data.services.some((s) => s.microservice_name === 'second')).toBe(false);
    });

    it('answers 200 with only failures when every service is refused', async () => {
      const api = apiAs();
      await api.services.create(body([withIp('owner', '10.30.9.8')]));
      const result = await api.services.create(body([withIp('copy', '10.30.9.8')]));

      expect(result.deployed_services).toEqual([]);
      expect(result.failed_services).toHaveLength(1);
    });

    it('fails with 500 for a unikernel without arch, like the backend KeyError', async () => {
      const api = apiAs();
      await expectApiError(
        api.services.create(
          body([
            {
              microservice_name: 'uk',
              microservice_namespace: 'test',
              virtualization: 'unikernel',
              code: 'x',
            },
          ]),
        ),
        500,
      );
    });
  });

  it('applies ownership and admin-only listing', async () => {
    const alice = apiAs({ username: 'alice' });
    const aliceId = store.data.users.find((user) => user.name === 'alice')!._id;
    const adminId = store.data.users.find((user) => user.name === 'Admin')!._id;
    expect((await alice.applications.listForUser(aliceId)).map((a) => a.application_name)).toEqual([
      'analytics',
    ]);
    await expectApiError(alice.applications.listForUser(adminId), 401);
    await expectApiError(alice.applications.list(), 403);
    await expectApiError(alice.services.list(), 403);

    const admin = apiAs();
    expect((await admin.applications.list()).length).toBe(store.data.applications.length);
    const services = await admin.services.list();
    expect(services.some((service) => service.instance_list.length > 0)).toBe(true);
  });

  it('keeps new instances in REQUESTED until the startup delay passed', async () => {
    let now = Date.now();
    const slow = createMockServer({
      baseUrl: 'http://slow.test/api',
      instanceStartupMs: 5000,
      now: () => now,
    });
    server.use(...slow.server.listHandlers());
    const { accessToken } = createMockSession(slow.store, { now });
    const api = createOakestraApi(
      createOakestraClient({
        baseUrl: 'http://slow.test/api',
        fetch: (request) => {
          request.headers.set('Authorization', `Bearer ${accessToken}`);
          return fetch(request);
        },
      }),
    );
    const serviceId = slow.store.data.services[0]!._id;
    const before = (await api.services.get(serviceId)).instance_list.length;
    await api.instances.deploy(serviceId);
    const requested = await api.services.get(serviceId);
    // Like the real backend: the service is REQUESTED and gains its instance only after scheduling.
    expect(requested.status).toBe('REQUESTED');
    expect(requested.instance_list).toHaveLength(before);
    now += 5000;
    const running = await api.services.get(serviceId);
    expect(running.status).toBe('RUNNING');
    expect(running.instance_list).toHaveLength(before + 1);
    expect(running.instance_list.at(-1)).not.toHaveProperty('_pending_until');
  });
});

describe('clusters and organizations', () => {
  it('lists clusters without a token and parses their metrics', async () => {
    const clusters = await anonymous().clusters.list();
    expect(clusters.map((cluster) => cluster.cluster_name)).toEqual([
      'test-cluster',
      'edge-munich',
    ]);
    expect((await anonymous().clusters.listActive()).length).toBe(1);
    expect(clusters[0]?.cpu_history[0]?.timestamp).toBeInstanceOf(Date);
  });

  it('manages organizations as admin only', async () => {
    const admin = apiAs();
    const org = await admin.organizations.create({ name: 'lab', member: [] });
    await admin.organizations.update(org._id, {
      name: 'lab2',
      member: [{ user_id: store.data.users[1]!._id, roles: ['Application_Provider'] }],
    });
    expect((await admin.organizations.list()).find((o) => o._id === org._id)).toMatchObject({
      name: 'lab2',
      member: [{ roles: ['Application_Provider'] }],
    });
    await admin.organizations.delete(org._id);
    await expectApiError(apiAs({ username: 'bob' }).organizations.list(), 403);
  });
});
