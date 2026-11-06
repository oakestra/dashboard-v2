import type { Service, SlaMicroservice } from '@oakestra/api';
import { describe, expect, it } from 'vitest';

import { fromService, fromSlaMicroservice, parseLimitParam, toSlaMicroservice } from './convert';
import { buildSla, importSla, type SlaContext } from './document';
import { defaultConstraint, defaultServiceValues, serviceFormSchema } from './schema';

const context: SlaContext = {
  customerId: 'org1',
  application: { _id: 'app1', application_name: 'shop', application_namespace: 'default' },
};

const full: SlaMicroservice = {
  microservice_name: 'api',
  microservice_namespace: 'prod',
  virtualization: 'container',
  description: 'The API',
  code: 'docker.io/library/nginx:alpine',
  memory: 256,
  vcpus: 2,
  vgpus: 1,
  storage: 10,
  bandwidth_in: 100,
  bandwidth_out: 200,
  port: '8081:80/tcp;53:53/udp',
  cmd: ['/bin/sh', '-c'],
  args: ['echo hi'],
  environment: ['MODE=prod', 'URL=http://x/?a=b'],
  one_shot: true,
  added_files: ['http://files/a.txt'],
  addresses: {
    rr_ip: '10.30.0.1',
    closest_ip_v6: '::1',
    instances: [{ from: '10.30.1.1', to: '10.30.1.9', start: '10.30.1.1' }],
  },
  constraints: [
    { type: 'latency', area: 'munich-1', threshold: 30, rigidness: 0.9, convergence_time: 300 },
    { type: 'geo', location: '(11.58,48.14)', threshold: 50, rigidness: 1, convergence_time: 60 },
    { type: 'clusters', allowed: ['c1', 'c2'] },
    { type: 'direct', cluster: 'c1', node: 'node-a' },
    { type: 'addons', needs: ['gpu'] },
  ],
  connectivity: [
    {
      target_microservice_id: 'abc',
      con_constraints: [{ type: 'latency', threshold: 20, rigidness: 0.9, convergence_time: 300 }],
    },
  ],
  volumes: [{ volume_id: 'v1', csi_driver: 'nfs' }],
};

describe('service form schema', () => {
  it('has defaults that only miss the required fields', () => {
    const result = serviceFormSchema.safeParse(defaultServiceValues());
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join('.'));
    expect(paths?.sort()).toEqual(['code', 'name']);
  });

  it('accepts a minimal service', () => {
    const values = { ...defaultServiceValues(), name: 'web', code: 'nginx' };
    expect(serviceFormSchema.safeParse(values).success).toBe(true);
  });

  it('applies the backend name pattern', () => {
    const base = { ...defaultServiceValues(), code: 'nginx' };
    expect(serviceFormSchema.safeParse({ ...base, name: 'my-svc' }).success).toBe(false);
    expect(serviceFormSchema.safeParse({ ...base, name: 'a'.repeat(33) }).success).toBe(false);
    expect(serviceFormSchema.safeParse({ ...base, name: 'a'.repeat(32) }).success).toBe(true);
  });

  it('validates constraints', () => {
    const base = { ...defaultServiceValues(), name: 'web', code: 'nginx' };
    const latency = { ...defaultConstraint('latency'), area: 'x', threshold: '20' };
    expect(serviceFormSchema.safeParse({ ...base, constraints: [latency] }).success).toBe(true);
    expect(
      serviceFormSchema.safeParse({ ...base, constraints: [{ ...latency, rigidness: '2' }] })
        .success,
    ).toBe(false);
    const geo = { ...defaultConstraint('geo'), latitude: '91', longitude: '10', threshold: '5' };
    expect(serviceFormSchema.safeParse({ ...base, constraints: [geo] }).success).toBe(false);
    expect(
      serviceFormSchema.safeParse({ ...base, constraints: [defaultConstraint('clusters')] })
        .success,
    ).toBe(false);
  });

  it('rejects malformed addresses and ports', () => {
    const base = { ...defaultServiceValues(), name: 'web', code: 'nginx' };
    expect(
      serviceFormSchema.safeParse({
        ...base,
        addresses: { ...base.addresses, rr_ip: '300.1.1.1' },
      }).success,
    ).toBe(false);
    expect(
      serviceFormSchema.safeParse({
        ...base,
        ports: [{ host: '70000', container: '80', protocol: 'tcp' }],
      }).success,
    ).toBe(false);
  });
});

describe('SLA conversion', () => {
  it('round-trips import -> form -> export without losing fields', () => {
    const values = fromSlaMicroservice(full);
    const parsed = serviceFormSchema.safeParse(values);
    expect(parsed.success).toBe(true);
    expect(toSlaMicroservice(values)).toEqual(full);
  });

  it('never exports empty values or a microserviceID', () => {
    const values = { ...defaultServiceValues(), name: 'web', code: 'nginx' };
    const exported = toSlaMicroservice({ ...values, extra: { microserviceID: 'x' } });
    expect(exported).toMatchObject({ microservice_name: 'web', memory: 100, vcpus: 1 });
    expect(exported).not.toHaveProperty('port');
    expect(exported).not.toHaveProperty('addresses');
    expect(exported).not.toHaveProperty('state');
  });

  it('keeps an unparseable port string instead of dropping it', () => {
    const values = fromSlaMicroservice({ ...full, port: 'weird' });
    expect(values.ports).toEqual([]);
    expect(toSlaMicroservice(values).port).toBe('weird');
  });

  it('prefills a duplicate from a stored service without runtime state', () => {
    const service = {
      _id: 's1',
      microservice_name: 'frontend',
      microservice_namespace: 'shop',
      virtualization: 'docker',
      code: 'nginx',
      port: '8081:80/tcp',
      memory: 64,
      status: 'RUNNING',
      instance_list: [],
      cmd: [],
      args: [],
      environment: ['A=1'],
      added_files: [],
      constraints: [],
      connectivity: [],
    } as unknown as Service;
    const values = fromService(service);
    expect(values.name).toBe('frontendcopy');
    expect(values.virtualization).toBe('container');
    expect(values.ports).toEqual([{ host: '8081', container: '80', protocol: 'tcp' }]);
    expect(values.extra).toEqual({});
    expect(serviceFormSchema.safeParse(values).success).toBe(true);
  });

  it('does not carry the original round-robin addresses into a duplicate', () => {
    const service = {
      _id: 's1',
      microservice_name: 'frontend',
      microservice_namespace: 'shop',
      code: 'nginx',
      RR_ip: '10.30.0.5',
      RR_ip_v6: 'fdff::5',
      addresses: {
        rr_ip: '10.30.0.5',
        RR_ip: '10.30.0.5',
        rr_ip_v6: 'fdff::5',
        closest_ip: '10.30.1.1',
      },
    } as unknown as Service;
    const values = fromService(service);
    expect(values.addresses).toMatchObject({ rr_ip: '', rr_ip_v6: '', closest_ip: '10.30.1.1' });
    const body = toSlaMicroservice(values);
    expect(JSON.stringify(body)).not.toMatch(/10\.30\.0\.5|fdff::5/);
    expect(body.addresses).toEqual({ closest_ip: '10.30.1.1' });
  });

  it('carries every SLA field of a stored service into a duplicate, e.g. volumes', () => {
    const volumes = [{ volume_id: 'v1', csi_driver: 'local', mount_path: '/data' }];
    const service = {
      _id: 's1',
      microservice_name: 'frontend',
      microservice_namespace: 'shop',
      code: 'nginx',
      volumes,
    } as unknown as Service;
    const values = fromService(service);
    expect(values.extra).toEqual({ volumes });
    expect(toSlaMicroservice(values).volumes).toEqual(volumes);
  });

  it('keeps a long duplicate name within 32 characters', () => {
    const service = {
      _id: 's1',
      microservice_name: 'a'.repeat(32),
      microservice_namespace: 'shop',
      code: 'x',
    } as unknown as Service;
    expect(fromService(service).name).toHaveLength(32);
  });
});

describe('parseLimitParam', () => {
  it('accepts whole numbers of at least 1', () => {
    expect(parseLimitParam('1')).toBe('1');
    expect(parseLimitParam('18700')).toBe('18700');
    expect(parseLimitParam('007')).toBe('7');
  });

  it.each([null, '', '0', '-1', '1.5', '1e3', ' 4', 'abc', '99999999999999999999'])(
    'ignores %j',
    (value) => {
      expect(parseLimitParam(value)).toBeUndefined();
    },
  );
});

describe('unikernel architecture', () => {
  const unikernel = { ...full, virtualization: 'unikernel', arch: ['amd64'] };

  it('is required for unikernels only', () => {
    const base = fromSlaMicroservice({ ...full, virtualization: 'unikernel', arch: undefined });
    const result = serviceFormSchema.safeParse(base);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['arch']);
    expect(serviceFormSchema.safeParse({ ...base, virtualization: 'container' }).success).toBe(
      true,
    );
    expect(serviceFormSchema.safeParse({ ...base, arch: ['arm64'] }).success).toBe(true);
  });

  it('survives import, export and duplicate', () => {
    expect(fromSlaMicroservice(unikernel).arch).toEqual(['amd64']);
    expect(toSlaMicroservice(fromSlaMicroservice(unikernel)).arch).toEqual(['amd64']);
    const stored = { ...unikernel, _id: 's1', instance_list: [] } as unknown as Service;
    expect(fromService(stored).arch).toEqual(['amd64']);
  });

  it('is not sent for containers, whatever an imported file carried', () => {
    const body = toSlaMicroservice(fromSlaMicroservice({ ...full, arch: ['amd64'] }));
    expect(body).not.toHaveProperty('arch');
  });
});

describe('SLA documents', () => {
  const v2 = (overrides: Record<string, unknown> = {}, app: Record<string, unknown> = {}) =>
    JSON.stringify({
      sla_version: 'v2.0',
      customerID: 'org1',
      applications: [
        {
          applicationID: 'app1',
          application_name: 'shop',
          application_namespace: 'default',
          microservices: [full],
          ...app,
        },
      ],
      ...overrides,
    });

  it('builds a valid v2 body for the first application', () => {
    const sla = buildSla(context, [{ ...full, microserviceID: 'ignored' }]);
    expect(sla.sla_version).toBe('v2.0');
    expect(sla.customerID).toBe('org1');
    expect(sla.applications[0]).toMatchObject({ applicationID: 'app1', application_name: 'shop' });
    expect(sla.applications[0]?.microservices[0]).not.toHaveProperty('microserviceID');
  });

  it('imports v2 and legacy files', () => {
    const modern = importSla(v2(), context);
    expect(modern).toMatchObject({ ok: true, warnings: [] });
    const legacy = importSla(JSON.stringify({ microservices: [full] }), context);
    expect(legacy.ok && legacy.microservices).toHaveLength(1);
    expect(legacy.ok && legacy.warnings[0]).toMatch(/Legacy/);
  });

  it('accepts other customers and applications with a warning, since ids are replaced on build', () => {
    const customer = importSla(v2({ customerID: 'other' }), context);
    expect(customer.ok && customer.warnings.join(' ')).toMatch(
      /customer "other".*current organization/,
    );
    const application = importSla(v2({}, { applicationID: 'zzz' }), context);
    expect(application.ok && application.warnings.join(' ')).toMatch(/application "zzz".*shop/);

    const built = buildSla(context, customer.ok ? customer.microservices : []);
    expect(built.customerID).toBe('org1');
    expect(built.applications[0]?.applicationID).toBe('app1');
  });

  it('explains broken files', () => {
    const bad = importSla('{nope', context);
    expect(!bad.ok && bad.error).toMatch(/not valid JSON/);
    const invalid = importSla(JSON.stringify({ hello: 1 }), context);
    expect(!invalid.ok && invalid.error).toMatch(/Not a valid SLA/);
    const { code: _code, ...noCode } = full;
    const missing = importSla(v2({}, { microservices: [noCode] }), context);
    expect(!missing.ok && missing.error).toBe(
      'Not a valid SLA file. applications[0].microservices[0].code is required',
    );
    const empty = importSla(v2({}, { microservices: [] }), context);
    expect(!empty.ok && empty.error).toMatch(/does not contain any service/);
  });

  it('returns every service of a multi-service file', () => {
    const result = importSla(
      v2({}, { microservices: [full, { ...full, microservice_name: 'b' }] }),
      context,
    );
    expect(result.ok && result.microservices).toHaveLength(2);
  });
});
