import { slaV2Schema, type SlaMicroservice } from '@oakestra/api';
import { delay, http, HttpResponse, type HttpHandler } from 'msw';

import {
  createObjectId,
  ROOT_ORGANIZATION,
  type MockApplication,
  type MockInstance,
  type MockService,
  type MockStore,
  type MockUser,
} from './store.ts';
import { createMockToken, verifyMockToken, type DecodedMockToken } from './tokens.ts';

export interface MockApiOptions {
  /** The `apiUrl` the client is configured with, e.g. `http://localhost:10000/api`. */
  baseUrl: string;
  store: MockStore;
  /** Access token lifetime. The real default is 10 minutes. */
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  /** Added to every response, so loading states are visible in the browser. */
  delayMs?: number;
  /** How long a new instance stays `REQUESTED` before it turns `RUNNING`. */
  instanceStartupMs?: number;
  /** Injectable clock for token expiry tests. */
  now?: () => number;
}

/**
 * What a real `/users/` or `/user/{name}` response carries in `password`. A fake, but present, so
 * tests notice if a model stops stripping it.
 */
export const LEAKED_PASSWORD_PLACEHOLDER = 'pbkdf2:sha256:mock$not-a-real-hash';

const json = (body: unknown, status = 200) => HttpResponse.json(body as never, { status });
const notFound = () => json({ code: 404, status: 'Not Found' }, 404);
const forbidden = () => json({ message: 'You have not enough permissions!' }, 403);
const ok = (message = 'ok') => json({ message });

type Resolver = (args: {
  request: Request;
  params: Record<string, string | readonly string[] | undefined>;
}) => Response | Promise<Response>;

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Request bodies are untrusted; anything that is not a string counts as missing. */
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function param(
  params: Record<string, string | readonly string[] | undefined>,
  name: string,
): string {
  const value = params[name];
  return typeof value === 'string' ? decodeURIComponent(value) : '';
}

export function createHandlers(options: MockApiOptions): HttpHandler[] {
  const { store } = options;
  const base = options.baseUrl.replace(/\/+$/, '');
  const url = (path: string) => `${base}${path}`;
  const now = options.now ?? Date.now;
  const accessTtl = options.accessTokenTtlSeconds ?? 600;
  const refreshTtl = options.refreshTokenTtlSeconds ?? 7 * 24 * 3600;
  const startupMs = options.instanceStartupMs ?? 0;

  const db = () => store.data;
  const findUser = (name: string) => db().users.find((user) => user.name === name);
  const findOrganization = (id: string) => db().organizations.find((org) => org._id === id);
  const rootOrganization = () => db().organizations.find((org) => org.name === ROOT_ORGANIZATION)!;

  function rolesIn(organizationId: string, userId: string): string[] {
    return findOrganization(organizationId)?.member.find((m) => m.user_id === userId)?.roles ?? [];
  }

  function publicUser(user: MockUser, roles?: string[]) {
    const { password: _password, ...rest } = user;
    return { ...rest, password: LEAKED_PASSWORD_PLACEHOLDER, ...(roles ? { roles } : {}) };
  }

  function settle(service: MockService): MockService {
    for (const instance of service.instance_list) {
      const pendingUntil = instance._pending_until;
      if (typeof pendingUntil === 'number' && pendingUntil <= now()) {
        instance.status = 'RUNNING';
        instance.status_detail = 'Instance running';
        delete instance._pending_until;
        service.status = 'RUNNING';
      }
    }
    return service;
  }

  function wireService(service: MockService) {
    const settled = settle(service);
    return {
      ...settled,
      // The real system-manager only adds an instance once the scheduler placed it; until then
      // the service itself is REQUESTED and its instance_list does not grow.
      instance_list: settled.instance_list
        .filter((instance) => instance._pending_until === undefined)
        .map(({ _pending_until: _hidden, ...instance }) => instance),
    };
  }

  /** Access-token protected handler, optionally limited to a role (checked on the token, like the backend). */
  function authed(
    resolver: (
      args: Parameters<Resolver>[0] & { token: DecodedMockToken },
    ) => Response | Promise<Response>,
    role?: string,
  ): Resolver {
    return (args) => {
      const check = verifyMockToken(args.request.headers.get('Authorization'), 'access', now());
      if (!check.ok) return json({ msg: check.msg }, check.status);
      if (role && !check.token.roles.includes(role)) return forbidden();
      return resolver({ ...args, token: check.token });
    };
  }

  /** `@identity_is_username()`: the path's username must be the caller. */
  function self(resolver: Parameters<typeof authed>[0]): Resolver {
    return authed((args) =>
      param(args.params, 'username') === args.token.sub ? resolver(args) : forbidden(),
    );
  }

  function ownedApplication(id: string, username: string): MockApplication | undefined {
    return db().applications.find((app) => app._id === id && app.userId === username);
  }

  function ownsService(service: MockService, username: string): boolean {
    return ownedApplication(service.applicationID, username) !== undefined;
  }

  function createService(app: MockApplication, sla: SlaMicroservice): MockService {
    const id = createObjectId();
    const service: MockService = {
      ...sla,
      _id: id,
      microserviceID: id,
      microservice_name: sla.microservice_name,
      microservice_namespace: sla.microservice_namespace,
      applicationID: app._id,
      app_name: app.application_name,
      app_ns: app.application_namespace,
      service_name: sla.microservice_name,
      service_ns: sla.microservice_namespace,
      job_name: `${app.application_name}.${app.application_namespace}.${sla.microservice_name}.${sla.microservice_namespace}`,
      image: sla.code,
      cmd: sla.cmd ?? [],
      port: sla.port ?? '',
      state: sla.state ?? '',
      memory: sla.memory ?? 0,
      vcpus: sla.vcpus ?? 0,
      vgpus: sla.vgpus ?? 0,
      vtpus: sla.vtpus ?? 0,
      storage: sla.storage ?? 0,
      bandwidth_in: sla.bandwidth_in ?? 0,
      bandwidth_out: sla.bandwidth_out ?? 0,
      instance_list: [],
      next_instance_progressive_number: 0,
    };
    db().services.push(service);
    app.microservices.push(id);
    return service;
  }

  const handlers: HttpHandler[] = [
    // Auth
    http.post(url('/auth/login'), async ({ request }) => {
      const body = await readJson(request);
      const organizationName =
        typeof body.organization_name === 'string' ? body.organization_name : ROOT_ORGANIZATION;
      const organization = db().organizations.find((org) => org.name === organizationName);
      if (!organization) return json({ code: 404, status: 'Not Found' }, 404);
      const user = findUser(text(body.username));
      if (!user || user.password !== body.password) {
        return json({ code: 401, status: 'Unauthorized' }, 401);
      }
      const claims = {
        sub: user.name,
        roles: rolesIn(organization._id, user._id),
        organization: organization._id,
      };
      return json({
        token: createMockToken(claims, { ttlSeconds: accessTtl, now: now() }),
        refresh_token: createMockToken(claims, {
          type: 'refresh',
          ttlSeconds: refreshTtl,
          now: now(),
        }),
      });
    }),
    http.post(url('/auth/refresh'), ({ request }) => {
      const check = verifyMockToken(request.headers.get('Authorization'), 'refresh', now());
      if (!check.ok) return json({ msg: check.msg }, check.status);
      if (!findUser(check.token.sub)) return json({ code: 404, status: 'Not Found' }, 404);
      const { sub, roles, organization } = check.token;
      return json({
        token: createMockToken({ sub, roles, organization }, { ttlSeconds: accessTtl, now: now() }),
      });
    }),
    http.post(
      url('/auth/register'),
      authed(async ({ request, token }) => {
        const body = await readJson(request);
        const name = text(body.name);
        const password = text(body.password);
        if (!name || !password) return json({ message: 'Invalid information' }, 404);
        if (findUser(name)) return json({ message: 'Username already exists' }, 409);
        const user: MockUser = {
          _id: createObjectId(),
          name,
          password,
          email: text(body.email),
          created_at: text(body.created_at),
        };
        db().users.push(user);
        const roles = Array.isArray(body.roles) ? body.roles.map(String) : [];
        findOrganization(token.organization)?.member.push({ user_id: user._id, roles });
        return json(publicUser(user, roles), 201);
      }, 'Admin'),
    ),

    // Password reset (public)
    http.post(url('/user/'), async ({ request }) => {
      const body = await readJson(request);
      const user = findUser(text(body.username));
      if (!user) return json({ message: 'User does not exists' }, 404);
      const token = createObjectId();
      db().resetTokens.push({ token, username: user.name, expiresAt: now() + 3600_000 });
      // Stands in for the email the real backend sends.
      console.info(
        `[mocks] password reset link: http://${text(body.domain)}/resetPassword/${token}`,
      );
      return json({});
    }),
    http.put(url('/user/'), async ({ request }) => {
      const body = await readJson(request);
      const index = db().resetTokens.findIndex((entry) => entry.token === body.token);
      const entry = db().resetTokens[index];
      if (!entry) return json({ message: 'Link invalid! Please request a new one!' }, 400);
      db().resetTokens.splice(index, 1);
      if (entry.expiresAt <= now()) {
        return json({ message: 'Link expired! Please request a new one!' }, 400);
      }
      const user = findUser(entry.username);
      if (user) user.password = text(body.password);
      return json({});
    }),

    // Users
    http.get(
      url('/user/:username'),
      self(({ params, token }) => {
        const user = findUser(param(params, 'username'));
        if (!user) return json(null);
        return json(publicUser(user, rolesIn(token.organization, user._id)));
      }),
    ),
    http.put(
      url('/user/:username'),
      authed(async ({ request, params, token }) => {
        const user = findUser(param(params, 'username'));
        if (!user) return json({ message: 'User does not exist' }, 500);
        const body = await readJson(request);
        if (Array.isArray(body.roles)) {
          const organization = findOrganization(token.organization);
          const member = organization?.member.find((m) => m.user_id === user._id);
          const roles = body.roles.map(String);
          if (member) member.roles = roles;
          else organization?.member.push({ user_id: user._id, roles });
        }
        if (typeof body.email === 'string') user.email = body.email;
        return json('ok');
      }, 'Admin'),
    ),
    http.delete(
      url('/user/:username'),
      authed(({ params }) => {
        const name = param(params, 'username');
        const user = findUser(name);
        if (user) {
          db().users = db().users.filter((candidate) => candidate !== user);
          for (const org of db().organizations) {
            org.member = org.member.filter((member) => member.user_id !== user._id);
          }
        }
        return json(db().users.map((candidate) => publicUser(candidate)));
      }, 'Admin'),
    ),
    http.post(
      url('/user/:username'),
      self(async ({ request, params }) => {
        const user = findUser(param(params, 'username'));
        if (!user) return json({ message: 'User does not exists' }, 404);
        const body = await readJson(request);
        if (body.oldPassword !== user.password) {
          return json({ message: 'Old password is not valid!' }, 400);
        }
        if (body.newPassword === user.password) {
          return json({ message: "Old password can't be the new password!" }, 400);
        }
        user.password = text(body.newPassword);
        return json({});
      }),
    ),
    http.get(
      url('/users/'),
      authed(() => json(db().users.map((user) => publicUser(user))), 'Admin'),
    ),
    http.get(
      url('/users/:organizationId'),
      authed(({ params }) => {
        const organization = findOrganization(param(params, 'organizationId'));
        if (!organization) return json([]);
        return json(
          organization.member.flatMap((member) => {
            const user = db().users.find((candidate) => candidate._id === member.user_id);
            return user ? [publicUser(user, member.roles)] : [];
          }),
        );
      }, 'Admin'),
    ),
    http.get(
      url('/permission/:username'),
      self(({ params, token }) => {
        const user = findUser(param(params, 'username'));
        if (!user) return json({ message: 'User does not exist.' }, 404);
        return json({ roles: rolesIn(token.organization, user._id) });
      }),
    ),

    // Applications
    http.get(
      url('/applications/'),
      authed(() => json(db().applications), 'Admin'),
    ),
    http.get(
      url('/applications/:userId'),
      authed(({ params, token }) => {
        // The backend compares against the caller's _id and answers a mismatch with 401.
        if (findUser(token.sub)?._id !== param(params, 'userId')) {
          return json({ code: 401, status: 'Unauthorized' }, 401);
        }
        return json(db().applications.filter((app) => app.userId === token.sub));
      }),
    ),
    http.get(
      url('/application/:appId'),
      authed(({ params, token }) => {
        const app = ownedApplication(param(params, 'appId'), token.sub);
        return app ? json(app) : notFound();
      }),
    ),
    http.post(
      url('/application/'),
      authed(async ({ request, token }) => {
        const result = slaV2Schema.safeParse(await readJson(request));
        if (!result.success)
          return json({ message: 'The given SLA was not formatted correctly' }, 422);
        for (const spec of result.data.applications) {
          const exists = db().applications.some(
            (app) =>
              app.userId === token.sub &&
              app.application_name === spec.application_name &&
              app.application_namespace === spec.application_namespace,
          );
          if (exists) {
            return json(
              { message: 'An application with the same name and namespace exists already' },
              409,
            );
          }
          const id = createObjectId();
          const app: MockApplication = {
            _id: id,
            applicationID: id,
            application_name: spec.application_name,
            application_namespace: spec.application_namespace,
            application_desc: spec.application_desc ?? '',
            microservices: [],
            userId: token.sub,
          };
          db().applications.push(app);
          for (const microservice of spec.microservices) createService(app, microservice);
        }
        return json(db().applications.filter((app) => app.userId === token.sub));
      }),
    ),
    http.put(
      url('/application/:appId'),
      authed(async ({ request, params, token }) => {
        const app = ownedApplication(param(params, 'appId'), token.sub);
        if (!app) return notFound();
        const body = await readJson(request);
        for (const key of [
          'application_name',
          'application_namespace',
          'application_desc',
        ] as const) {
          if (typeof body[key] === 'string') app[key] = body[key];
        }
        return ok('Application is updated');
      }),
    ),
    http.delete(
      url('/application/:appId'),
      authed(({ params, token }) => {
        const app = ownedApplication(param(params, 'appId'), token.sub);
        if (!app) return notFound();
        db().applications = db().applications.filter((candidate) => candidate !== app);
        db().services = db().services.filter((service) => service.applicationID !== app._id);
        return ok('Application Deleted');
      }),
    ),

    // Services
    http.get(
      url('/services/'),
      authed(() => json(db().services.map(wireService)), 'Admin'),
    ),
    http.get(
      url('/services/:appId'),
      authed(({ params, token }) => {
        const app = ownedApplication(param(params, 'appId'), token.sub);
        if (!app) return json({ message: 'app not found' }, 404);
        return json(
          db()
            .services.filter((s) => s.applicationID === app._id)
            .map(wireService),
        );
      }),
    ),
    http.get(
      url('/service/:serviceId'),
      authed(({ params, token }) => {
        const service = db().services.find((s) => s._id === param(params, 'serviceId'));
        if (!service || !ownsService(service, token.sub)) return json('not found', 404);
        return json(wireService(service));
      }),
    ),
    http.post(
      url('/service/'),
      authed(async ({ request, token }) => {
        const result = slaV2Schema.safeParse(await readJson(request));
        if (!result.success)
          return json({ message: 'The given SLA was not formatted correctly' }, 400);
        const spec = result.data.applications[0]!;
        const app = ownedApplication(spec.applicationID ?? '', token.sub);
        if (!app) return json({ message: 'application not found' }, 404);
        // system-manager indexes `arch` for unikernels, so a missing one is an unhandled KeyError.
        if (spec.microservices.some((ms) => ms.virtualization === 'unikernel' && !('arch' in ms))) {
          return json({ message: 'Internal Server Error' }, 500);
        }
        // Like the real flow: each service is inserted, then net-manager is told about it, and a
        // refusal there (a round-robin address that is already allocated) rolls that service back.
        // The response stays 200 and lists the outcome per service.
        const deployed: { service_name: string; status: number }[] = [];
        const failed: { service_name: string; message?: string; status: number }[] = [];
        let jobId = 'None';
        for (const microservice of spec.microservices) {
          const requested = microservice.addresses?.rr_ip;
          const taken =
            !!requested &&
            db().services.some((existing) => {
              const addresses = (existing.addresses ?? {}) as Record<string, unknown>;
              return addresses.rr_ip === requested || addresses.RR_ip === requested;
            });
          // The backend inserts first and rolls back when net-manager objects, and `job_id` is the
          // last inserted id either way, so after a refusal it can point at a deleted service.
          const service = createService(app, microservice);
          jobId = service._id;
          if (taken) {
            db().services = db().services.filter((candidate) => candidate !== service);
            app.microservices = app.microservices.filter((id) => id !== service._id);
            failed.push({
              service_name: microservice.microservice_name,
              message: `failed to deploy service: Service IP ${requested} is already in use`,
              status: 500,
            });
            continue;
          }
          deployed.push({ service_name: microservice.microservice_name, status: 200 });
        }
        return json({ job_id: jobId, deployed_services: deployed, failed_services: failed });
      }),
    ),
    // Mirrors the real backend, where service updates are not implemented yet.
    http.put(
      url('/service/:serviceId'),
      authed(() => json({ message: 'Not implemented' }, 501)),
    ),
    http.delete(
      url('/service/:serviceId'),
      authed(({ params, token }) => {
        const service = db().services.find((s) => s._id === param(params, 'serviceId'));
        if (!service || !ownsService(service, token.sub)) return json('Job not deleted', 500);
        db().services = db().services.filter((candidate) => candidate !== service);
        for (const app of db().applications) {
          app.microservices = app.microservices.filter((id) => id !== service._id);
        }
        return ok('Job deleted');
      }),
    ),

    // Instances
    http.post(
      url('/service/:serviceId/instance'),
      authed(({ params, token }) => {
        const service = db().services.find((s) => s._id === param(params, 'serviceId'));
        if (!service || !ownsService(service, token.sub)) return notFound();
        const cluster = db().clusters.find((candidate) => candidate.active);
        const instance: MockInstance = {
          instance_number: service.next_instance_progressive_number,
          status: startupMs > 0 ? 'REQUESTED' : 'RUNNING',
          status_detail: startupMs > 0 ? 'Waiting for scheduling decision' : 'Instance running',
          cluster_id: cluster?._id ?? '',
          cluster_location: cluster?.cluster_location ?? '',
          cpu_percent: '0.000000',
          memory_percent: '0.000000',
          disk: '0',
          cpu_history: [],
          memory_history: [],
          logs: '',
          ...(startupMs > 0 ? { _pending_until: now() + startupMs } : {}),
        };
        service.instance_list.push(instance);
        service.next_instance_progressive_number += 1;
        service.status = instance.status;
        return ok();
      }),
    ),
    http.delete(
      url('/service/:serviceId/instance/:instanceNumber'),
      authed(({ params, token }) => {
        const service = db().services.find((s) => s._id === param(params, 'serviceId'));
        if (!service || !ownsService(service, token.sub)) return notFound();
        const number = Number(param(params, 'instanceNumber'));
        service.instance_list = service.instance_list.filter((i) => i.instance_number !== number);
        return ok();
      }),
    ),

    // Clusters (public, like the real endpoints)
    http.get(url('/clusters/'), () => json(db().clusters)),
    http.get(url('/clusters/active'), () =>
      json(db().clusters.filter((cluster) => cluster.active)),
    ),

    // Organizations
    http.get(
      url('/organization/'),
      authed(() => json(db().organizations), 'Admin'),
    ),
    http.post(
      url('/organization/'),
      authed(async ({ request }) => {
        const body = await readJson(request);
        const organization = {
          _id: createObjectId(),
          name: text(body.name),
          member: Array.isArray(body.member)
            ? (body.member as { user_id: string; roles: string[] }[])
            : [],
        };
        db().organizations.push(organization);
        return json(organization);
      }, 'Admin'),
    ),
    http.put(
      url('/organization/:organizationId'),
      authed(async ({ request, params }) => {
        const organization = findOrganization(param(params, 'organizationId'));
        if (!organization) return notFound();
        const body = await readJson(request);
        if (typeof body.name === 'string') organization.name = body.name;
        if (Array.isArray(body.member)) {
          organization.member = body.member as { user_id: string; roles: string[] }[];
        }
        return ok('Organization is updated');
      }, 'Admin'),
    ),
    http.delete(
      url('/organization/:organizationId'),
      authed(({ params }) => {
        const id = param(params, 'organizationId');
        if (id === rootOrganization()._id) {
          return json({ message: 'Organization could not be deleted' }, 501);
        }
        const before = db().organizations.length;
        db().organizations = db().organizations.filter((org) => org._id !== id);
        if (db().organizations.length === before) return notFound();
        return ok('Organization deleted');
      }, 'Admin'),
    ),
  ];

  if (!options.delayMs) return handlers;
  const delayMs = options.delayMs;
  // A resolver that returns nothing falls through to the next matching handler.
  return [http.all(url('/*'), async () => void (await delay(delayMs))), ...handlers];
}
