import { describe, expect, it, vi } from 'vitest';

import samples from '../__fixtures__/backend-samples.json' with { type: 'json' };
import { applicationSchema } from './application.ts';
import { decodeTokenClaims, InvalidTokenError } from './auth.ts';
import { clusterSchema, parseClusterLocation } from './cluster.ts';
import { lenientArray, numeric, timestamp } from './common.ts';
import { organizationSchema } from './organization.ts';
import { serviceSchema } from './service.ts';
import { parseSlaDocument } from './sla.ts';
import { userSchema } from './user.ts';

// Shapes in __fixtures__/backend-samples.json are trimmed copies of real system-manager responses
// (password hashes replaced by fakes).

describe('numeric', () => {
  it('turns the numeric strings of instance metrics into numbers', () => {
    expect(numeric.parse('6336512.000000')).toBe(6336512);
    expect(numeric.parse(0.5)).toBe(0.5);
    expect(numeric.safeParse('').success).toBe(false);
    expect(numeric.safeParse('n/a').success).toBe(false);
  });
});

describe('timestamp', () => {
  it('accepts ISO strings (instances) and epoch seconds (clusters)', () => {
    expect(timestamp.parse('2026-11-01T15:34:12.046672+00:00').toISOString()).toBe(
      '2026-11-01T15:34:12.046Z',
    );
    expect(timestamp.parse(1790583581.450666).getTime()).toBe(1790583581450);
    expect(timestamp.parse(1790583581450).getTime()).toBe(1790583581450);
    expect(timestamp.parse('1790583581').getTime()).toBe(1790583581000);
    expect(timestamp.safeParse('yesterday').success).toBe(false);
  });
});

describe('serviceSchema', () => {
  it('normalizes instance metrics and history', () => {
    const service = serviceSchema.parse(samples.service_with_instances);
    const [instance] = service.instance_list;

    expect(service.microservice_name).toBe('frontend');
    expect(service.port).toBe('8081:80/tcp');
    expect(instance?.cpu_percent).toBe(0);
    expect(instance?.memory_percent).toBe(1654784);
    expect(instance?.disk).toBe(4096);
    expect(instance?.memory_history[0]).toEqual({
      timestamp: new Date('2026-11-01T15:34:12.046672+00:00'),
      value: 6336512,
    });
    expect(instance?.last_modified_timestamp).toBeInstanceOf(Date);
  });

  it('keeps unknown fields and defaults missing lists', () => {
    const service = serviceSchema.parse(samples.service_without_instances);
    expect(service.instance_list).toEqual([]);
    expect(service.addresses?.RR_ip).toBe('10.30.0.0');
    expect(service.status).toBeUndefined();
    // Loose: fields the models do not know about still reach the caller.
    expect((service as Record<string, unknown>).service_ns).toBe(
      samples.service_without_instances.service_ns,
    );
  });

  it('turns a malformed metric into undefined instead of failing the service', () => {
    const service = serviceSchema.parse({
      ...samples.service_with_instances,
      instance_list: [{ instance_number: 0, cpu_percent: 'garbage', cpu_history: [{}] }],
    });
    expect(service.instance_list[0]?.cpu_percent).toBeUndefined();
    expect(service.instance_list[0]?.cpu_history).toEqual([]);
  });
});

describe('clusterSchema', () => {
  it('parses epoch history and deduplicates virtualization', () => {
    const cluster = clusterSchema.parse({
      ...samples.cluster,
      virtualization: ['runc', 'docker', 'runc', 'docker'],
    });
    expect(cluster.cpu_history[0]?.timestamp).toEqual(new Date(1790583581450));
    expect(cluster.virtualization).toEqual(['runc', 'docker']);
    expect(cluster.active).toBe(true);
  });
});

describe('parseClusterLocation', () => {
  it.each([
    ['52.5200,13.4050,100', { latitude: 52.52, longitude: 13.405, radius: 100 }],
    [' 48.1 , 11.5 ', { latitude: 48.1, longitude: 11.5 }],
    ['', null],
    [undefined, null],
    ['52.52', null],
    ['91,0,1', null],
    ['0,181,1', null],
    ['a,b,c', null],
    ['1,2,-5', null],
    ['1,2,3,4', null],
  ])('%j -> %j', (input, expected) => {
    expect(parseClusterLocation(input)).toEqual(expected);
  });
});

describe('userSchema', () => {
  it('strips the password hash and other unknown fields', () => {
    const user = userSchema.parse(samples.user);
    expect(user).not.toHaveProperty('password');
    expect(JSON.stringify(user)).not.toContain('pbkdf2');
    expect(user.roles).toContain('Admin');
  });

  it('drops the password reset tokens /users/ returns along with real users', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const users = lenientArray(userSchema, 'users').parse(samples.users);
    expect(users.map((user) => user.name)).toEqual(['Admin', 'alice', 'bob', 'carol', 'dave']);
    expect(JSON.stringify(users)).not.toContain('pbkdf2');
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('applicationSchema and organizationSchema', () => {
  it('parse the real list shapes', () => {
    const app = applicationSchema.parse(samples.applications[0]);
    expect(app.microservices.length).toBeGreaterThan(0);
    expect(
      applicationSchema.parse({ ...samples.applications[0], microservices: [{ _id: 'x' }] })
        .microservices,
    ).toEqual(['x']);

    const [root] = samples.organizations.map((org) => organizationSchema.parse(org));
    expect(root?.name).toBe('root');
    expect(root?.member[0]?.roles).toContain('Admin');
  });
});

function fakeJwt(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(payload)}.sig`;
}

describe('decodeTokenClaims', () => {
  it('reads the claims the dashboard relies on', () => {
    const claims = decodeTokenClaims(
      fakeJwt({ sub: 'Jürgen', roles: ['Admin'], organization: 'abc', exp: 1793550822 }),
    );
    expect(claims).toMatchObject({ sub: 'Jürgen', roles: ['Admin'], organization: 'abc' });
  });

  it('rejects things that are not access tokens', () => {
    expect(() => decodeTokenClaims('garbage')).toThrow(InvalidTokenError);
    expect(() => decodeTokenClaims(fakeJwt({ roles: [] }))).toThrow(InvalidTokenError);
  });
});

describe('parseSlaDocument', () => {
  const microservice = {
    microservice_name: 'web',
    microservice_namespace: 'default',
    virtualization: 'container',
    code: 'docker.io/library/nginx:latest',
  };

  it('detects v2 documents', () => {
    const result = parseSlaDocument({
      sla_version: 'v2.0',
      customerID: 'org',
      applications: [
        { application_name: 'shop', application_namespace: 'shop', microservices: [microservice] },
      ],
    });
    expect(result.version).toBe('v2');
  });

  it('detects the old dashboard export format', () => {
    expect(parseSlaDocument({ microservices: [microservice] }).version).toBe('v1');
  });

  it('enforces the backend name pattern', () => {
    expect(() =>
      parseSlaDocument({ microservices: [{ ...microservice, microservice_name: 'with-dash' }] }),
    ).toThrow();
  });
});
